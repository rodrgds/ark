package expo.modules.arkzim

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.kiwix.libzim.Archive
import org.kiwix.libzim.Entry
import org.kiwix.libzim.EntryNotFoundException
import org.kiwix.libzim.Query
import org.kiwix.libzim.Search
import org.kiwix.libzim.Searcher
import org.kiwix.libzim.SuggestionSearch
import org.kiwix.libzim.SuggestionSearcher
import java.io.File
import android.net.Uri
import java.nio.charset.StandardCharsets

class ArkZimModule : Module() {
  companion object {
    private var librariesLoaded = false
    private var libraryLoadError: String? = null

    init {
      try {
        System.loadLibrary("kiwix")
        System.loadLibrary("zim")
        System.loadLibrary("kiwix_wrapper")
        System.loadLibrary("zim_wrapper")
        librariesLoaded = true
      } catch (e: UnsatisfiedLinkError) {
        libraryLoadError = "Failed to load native ZIM libraries: ${e.message}"
      }
    }
  }

  private var currentArchive: Archive? = null
  private var currentArchivePath: String? = null
  private var currentSearcher: Searcher? = null
  private var currentSuggestionSearcher: SuggestionSearcher? = null

  override fun definition() = ModuleDefinition {
    Name("ArkZim")

    AsyncFunction("openArchive") { path: String ->
      ensureLibrariesLoaded()
      val cleanPath = if (path.startsWith("file://")) {
        Uri.parse(path).path ?: path
      } else {
        path
      }

      if (currentArchivePath == cleanPath && currentArchive != null) {
        return@AsyncFunction getMetadataMap()
      }

      disposeCurrentArchive()

      try {
        currentArchive = Archive(cleanPath)
        currentArchivePath = cleanPath
        currentSearcher = buildSearcher(currentArchive!!)
        currentSuggestionSearcher = buildSuggestionSearcher(currentArchive!!)
        return@AsyncFunction getMetadataMap()
      } catch (e: Exception) {
        disposeCurrentArchive()
        throw Exception("Could not open ZIM archive: ${e.message}")
      }
    }

    AsyncFunction("getArticle") { path: String ->
      ensureLibrariesLoaded()
      val archive = currentArchive ?: throw Exception("No archive open")
      try {
        val entry = resolveRedirect(archive.getEntryByPath(path))
        val item = entry.getItem(true)
        val data = item.getData()
        val article = mapOf(
          "html" to String(data.getData(), StandardCharsets.UTF_8),
          "mimeType" to item.getMimetype(),
          "finalPath" to item.getPath(),
          "title" to item.getTitle()
        )
        data.dispose()
        return@AsyncFunction article
      } catch (e: Exception) {
        throw Exception("Article not found: ${e.message}")
      }
    }

    AsyncFunction("search") { query: String, limit: Int ->
      ensureLibrariesLoaded()
      val archive = currentArchive ?: throw Exception("No archive open")
      if (archive.hasFulltextIndex() && currentSearcher != null) {
        return@AsyncFunction searchFullText(query, limit.coerceAtLeast(1))
      }
      return@AsyncFunction suggestTitles(query, limit.coerceAtLeast(1), includeSnippet = true)
    }

    AsyncFunction("suggest") { prefix: String, limit: Int ->
      ensureLibrariesLoaded()
      currentArchive ?: throw Exception("No archive open")
      return@AsyncFunction suggestTitles(prefix, limit.coerceAtLeast(1), includeSnippet = false)
    }
  }

  private fun ensureLibrariesLoaded() {
    if (!librariesLoaded) {
      throw Exception(libraryLoadError ?: "Native ZIM libraries failed to load.")
    }
  }

  private fun getMetadataMap(): Map<String, Any?> {
    val archive = currentArchive ?: return emptyMap()
    val mainPath = try {
      if (archive.hasMainEntry()) {
        val entry = archive.getMainEntry()
        val path = entry.getPath()
        // Verify the path actually resolves before advertising it
        archive.getEntryByPath(path)
        path
      } else null
    } catch (_: Exception) { null }

    return mapOf(
      "id" to archive.getUuid(),
      "title" to archive.metadataOrNull("Title", fallback = File(currentArchivePath ?: "").name),
      "description" to archive.metadataOrNull("Description"),
      "language" to archive.metadataOrNull("Language"),
      "articleCount" to archive.getArticleCount(),
      "mainPath" to mainPath,
      "hasFulltextIndex" to archive.hasFulltextIndex(),
      "hasTitleIndex" to archive.hasTitleIndex()
    )
  }

  private fun buildSearcher(archive: Archive): Searcher? {
    if (!archive.hasFulltextIndex()) return null
    return try {
      Searcher(archive)
    } catch (_: Exception) {
      null
    }
  }

  private fun buildSuggestionSearcher(archive: Archive): SuggestionSearcher? {
    if (!archive.hasTitleIndex()) return null
    return try {
      SuggestionSearcher(archive)
    } catch (_: Exception) {
      null
    }
  }

  private fun searchFullText(queryText: String, limit: Int): List<Map<String, String>> {
    val searcher = currentSearcher ?: return emptyList()
    val query = Query(queryText)
    val search: Search = searcher.search(query)
    val iterator = search.getResults(0, limit)
    val results = mutableListOf<Map<String, String>>()
    try {
      while (iterator.hasNext() && results.size < limit) {
        results.add(
          mapOf(
            "path" to iterator.getPath(),
            "title" to iterator.getTitle(),
            "snippet" to iterator.getSnippet()
          )
        )
        iterator.next()
      }
    } finally {
      iterator.dispose()
      search.dispose()
      query.dispose()
    }
    return results
  }

  private fun suggestTitles(
    prefix: String,
    limit: Int,
    includeSnippet: Boolean
  ): List<Map<String, String>> {
    val suggestionSearcher = currentSuggestionSearcher ?: return emptyList()
    val search: SuggestionSearch = suggestionSearcher.suggest(prefix)
    val iterator = search.getResults(0, limit)
    val results = mutableListOf<Map<String, String>>()
    try {
      while (iterator.hasNext() && results.size < limit) {
        val item = iterator.next()
        val row = mutableMapOf(
          "path" to item.getPath(),
          "title" to item.getTitle()
        )
        if (includeSnippet && item.hasSnippet()) {
          row["snippet"] = item.getSnippet()
        }
        results.add(row)
      }
    } finally {
      iterator.dispose()
      search.dispose()
    }
    return results
  }

  private fun resolveRedirect(entry: Entry): Entry {
    return if (entry.isRedirect()) entry.getRedirectEntry() else entry
  }

  private fun Archive.metadataOrNull(key: String, fallback: String? = null): String? {
    return try {
      getMetadata(key)
    } catch (_: EntryNotFoundException) {
      fallback
    } catch (_: Exception) {
      fallback
    }
  }

  private fun disposeCurrentArchive() {
    currentSearcher?.dispose()
    currentSuggestionSearcher?.dispose()
    currentArchive?.dispose()
    currentSearcher = null
    currentSuggestionSearcher = null
    currentArchive = null
    currentArchivePath = null
  }
}
