#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ArkZimReader : NSObject

- (nullable NSDictionary<NSString *, id> *)openArchive:(NSString *)path error:(NSError **)error;
- (nullable NSDictionary<NSString *, NSString *> *)getArticle:(NSString *)path error:(NSError **)error;
- (nullable NSArray<NSDictionary<NSString *, NSString *> *> *)search:(NSString *)query
                                                               limit:(NSInteger)limit
                                                               error:(NSError **)error;
- (nullable NSArray<NSDictionary<NSString *, NSString *> *> *)suggest:(NSString *)prefix
                                                                limit:(NSInteger)limit
                                                                error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
