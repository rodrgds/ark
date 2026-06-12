#import "ArkZimReader.h"

#include <memory>
#include <string>
#include <vector>

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"
#include "zim/archive.h"
#include "zim/blob.h"
#include "zim/entry.h"
#include "zim/item.h"
#include "zim/search.h"
#include "zim/suggestion.h"
#pragma clang diagnostic pop

static NSString *const ArkZimErrorDomain = @"ArkZim";

static NSString *ArkStringFromStd(const std::string &value);
static std::string ArkStdString(NSString *value);
static NSString *ArkUuidString(const zim::Uuid &uuid);

static NSString *ArkStringFromStd(const std::string &value) {
  NSString *string = [[NSString alloc] initWithBytes:value.data()
                                             length:value.size()
                                           encoding:NSUTF8StringEncoding];
  return string ?: @"";
}

static std::string ArkStdString(NSString *value) {
  const char *string = [value cStringUsingEncoding:NSUTF8StringEncoding];
  return string == nullptr ? std::string() : std::string(string);
}

static NSString *ArkUuidString(const zim::Uuid &uuid) {
  NSUUID *nsuuid = [[NSUUID alloc] initWithUUIDBytes:reinterpret_cast<const unsigned char *>(uuid.data)];
  return [[nsuuid UUIDString] lowercaseString];
}

@interface ArkZimReader () {
  std::unique_ptr<zim::Archive> _archive;
  NSString *_archivePath;
}
@end

@implementation ArkZimReader

- (nullable NSDictionary<NSString *, id> *)openArchive:(NSString *)path error:(NSError **)error {
  @synchronized (self) {
    NSString *cleanPath = [self cleanFilePath:path];
    if (cleanPath.length == 0) {
      [self assignError:error code:@"ERR_ZIM_PATH" message:@"Only local ZIM file paths are supported."];
      return nil;
    }

    if (_archive != nullptr && [_archivePath isEqualToString:cleanPath]) {
      return [self metadataForArchive:*_archive];
    }

    _archive.reset();
    _archivePath = nil;

    try {
      zim::setClusterCacheMaxSize(16777216);
      _archive = std::make_unique<zim::Archive>([cleanPath fileSystemRepresentation]);
      _archivePath = cleanPath;
      return [self metadataForArchive:*_archive];
    } catch (const std::exception &exception) {
      _archive.reset();
      _archivePath = nil;
      [self assignError:error
                  code:@"ERR_ZIM_OPEN"
               message:[NSString stringWithFormat:@"Could not open ZIM archive: %s", exception.what()]];
      return nil;
    }
  }
}

- (nullable NSDictionary<NSString *, NSString *> *)getArticle:(NSString *)path error:(NSError **)error {
  @synchronized (self) {
    zim::Archive *archive = [self currentArchiveOrAssignError:error];
    if (archive == nullptr) {
      return nil;
    }

    try {
      zim::Item item = [self itemInArchive:*archive path:path];
      zim::Blob blob = item.getData();
      NSString *html = [[NSString alloc] initWithBytes:blob.data()
                                                length:blob.size()
                                              encoding:NSUTF8StringEncoding];
      if (html == nil) {
        html = @"";
      }
      return @{
        @"html": html,
        @"mimeType": ArkStringFromStd(item.getMimetype()),
        @"finalPath": ArkStringFromStd(item.getPath()),
        @"title": ArkStringFromStd(item.getTitle())
      };
    } catch (const std::exception &exception) {
      [self assignError:error
                  code:@"ERR_ZIM_ARTICLE"
               message:[NSString stringWithFormat:@"Article not found: %s", exception.what()]];
      return nil;
    }
  }
}

- (nullable NSArray<NSDictionary<NSString *, NSString *> *> *)search:(NSString *)query
                                                               limit:(NSInteger)limit
                                                               error:(NSError **)error {
  @synchronized (self) {
    zim::Archive *archive = [self currentArchiveOrAssignError:error];
    if (archive == nullptr) {
      return nil;
    }

    NSInteger safeLimit = MAX(limit, 1);
    if (archive->hasFulltextIndex()) {
      NSArray<NSDictionary<NSString *, NSString *> *> *results = [self searchFullText:*archive query:query limit:safeLimit];
      if (results.count > 0) {
        return results;
      }
    }
    return [self suggestTitles:*archive prefix:query limit:safeLimit includeSnippet:YES];
  }
}

- (nullable NSArray<NSDictionary<NSString *, NSString *> *> *)suggest:(NSString *)prefix
                                                                limit:(NSInteger)limit
                                                                error:(NSError **)error {
  @synchronized (self) {
    zim::Archive *archive = [self currentArchiveOrAssignError:error];
    if (archive == nullptr) {
      return nil;
    }
    return [self suggestTitles:*archive prefix:prefix limit:MAX(limit, 1) includeSnippet:NO];
  }
}

- (NSDictionary<NSString *, id> *)metadataForArchive:(zim::Archive &)archive {
  NSString *mainPath = nil;
  try {
    zim::Entry mainEntry = archive.getMainEntry();
    zim::Item mainItem = mainEntry.getItem(mainEntry.isRedirect());
    mainPath = ArkStringFromStd(mainItem.getPath());
  } catch (const std::exception &) {
    mainPath = nil;
  }

  NSMutableDictionary<NSString *, id> *metadata = [NSMutableDictionary dictionary];
  metadata[@"id"] = ArkUuidString(archive.getUuid());
  metadata[@"title"] = [self metadataForArchive:archive key:"Title" fallback:[_archivePath lastPathComponent] ?: @"ZIM archive"];
  NSString *description = [self metadataForArchive:archive key:"Description" fallback:nil];
  if (description != nil) {
    metadata[@"description"] = description;
  }
  NSString *language = [self metadataForArchive:archive key:"Language" fallback:nil];
  if (language != nil) {
    metadata[@"language"] = language;
  }
  metadata[@"articleCount"] = @(archive.getArticleCount());
  if (mainPath != nil) {
    metadata[@"mainPath"] = mainPath;
  }
  metadata[@"hasFulltextIndex"] = @(archive.hasFulltextIndex());
  metadata[@"hasTitleIndex"] = @(archive.hasTitleIndex());
  return metadata;
}

- (NSArray<NSDictionary<NSString *, NSString *> *> *)searchFullText:(zim::Archive &)archive
                                                              query:(NSString *)query
                                                              limit:(NSInteger)limit {
  NSMutableArray<NSDictionary<NSString *, NSString *> *> *results = [NSMutableArray array];
  try {
    std::vector<zim::Archive> archives;
    archives.push_back(archive);
    zim::Searcher searcher = zim::Searcher(archives);
    zim::SearchResultSet resultSet = searcher.search(zim::Query(ArkStdString(query))).getResults(0, static_cast<int>(limit));

    for (auto result = resultSet.begin(); result != resultSet.end() && results.count < limit; result++) {
      zim::Item item = result->getItem(result->isRedirect());
      NSString *path = ArkStringFromStd(item.getPath());
      NSString *title = ArkStringFromStd(item.getTitle());
      if (title.length == 0) {
        title = path;
      }
      if (path.length == 0 || title.length == 0) {
        continue;
      }

      NSMutableDictionary<NSString *, NSString *> *row = [@{
        @"path": path,
        @"title": title
      } mutableCopy];
      NSString *snippet = ArkStringFromStd(result.getSnippet());
      if (snippet.length > 0) {
        row[@"snippet"] = snippet;
      }
      [results addObject:row];
    }
  } catch (const std::exception &) {
    return @[];
  }
  return results;
}

- (NSArray<NSDictionary<NSString *, NSString *> *> *)suggestTitles:(zim::Archive &)archive
                                                            prefix:(NSString *)prefix
                                                             limit:(NSInteger)limit
                                                    includeSnippet:(BOOL)includeSnippet {
  (void)includeSnippet;
  NSMutableArray<NSDictionary<NSString *, NSString *> *> *results = [NSMutableArray array];
  try {
    auto resultSet = zim::SuggestionSearcher(archive).suggest(ArkStdString(prefix)).getResults(0, static_cast<int>(limit));
    for (auto result = resultSet.begin(); result != resultSet.end() && results.count < limit; result++) {
      NSString *path = ArkStringFromStd(result->getPath());
      NSString *title = ArkStringFromStd(result->getTitle());
      if (path.length == 0 || title.length == 0) {
        continue;
      }
      NSMutableDictionary<NSString *, NSString *> *row = [@{
        @"path": path,
        @"title": title
      } mutableCopy];
      [results addObject:row];
    }
  } catch (const std::exception &) {
    return @[];
  }
  return results;
}

- (zim::Item)itemInArchive:(zim::Archive &)archive path:(NSString *)path {
  NSString *normalizedPath = path;
  if ([normalizedPath hasPrefix:@"/"]) {
    normalizedPath = [normalizedPath substringFromIndex:1];
  }
  zim::Entry entry = archive.getEntryByPath(ArkStdString(normalizedPath));
  return entry.getItem(entry.isRedirect());
}

- (nullable zim::Archive *)currentArchiveOrAssignError:(NSError **)error {
  if (_archive == nullptr) {
    [self assignError:error code:@"ERR_ZIM_NOT_OPEN" message:@"No ZIM archive is open."];
    return nullptr;
  }
  return _archive.get();
}

- (NSString *)cleanFilePath:(NSString *)path {
  if ([path hasPrefix:@"file://"]) {
    NSURL *url = [NSURL URLWithString:path];
    return url.path ?: @"";
  }
  if ([path hasPrefix:@"/"]) {
    return path;
  }
  return @"";
}

- (nullable NSString *)metadataForArchive:(zim::Archive &)archive
                                      key:(const char *)key
                                 fallback:(nullable NSString *)fallback {
  try {
    NSString *value = ArkStringFromStd(archive.getMetadata(key));
    return value.length > 0 ? value : fallback;
  } catch (const std::exception &) {
    return fallback;
  }
}

- (void)assignError:(NSError **)error code:(NSString *)code message:(NSString *)message {
  if (error == nil) {
    return;
  }
  *error = [NSError errorWithDomain:ArkZimErrorDomain
                               code:1
                           userInfo:@{
                             NSLocalizedDescriptionKey: message,
                             @"code": code
                           }];
}

@end
