package expo.modules.arkzim

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.kiwix.libkiwix.Archive
import java.io.File
import android.net.Uri

class ArkZimModule : Module() {
  private var currentArchive: Archive? = null
  private var currentArchivePath: String? = null

  override fun definition() = ModuleDefinition {
    Name("ArkZim")

    AsyncFunction("openArchive") { path: String ->
      val cleanPath = if (path.startsWith("file://")) {
        Uri.parse(path).path ?: path
      } else {
        path
      }

      if (currentArchivePath == cleanPath && currentArchive != null) {
        return@AsyncFunction getMetadataMap()
      }

      currentArchive?.close()
      
      try {
        currentArchive = Archive(cleanPath)
        currentArchivePath = cleanPath
        return@AsyncFunction getMetadataMap()
      } catch (e: Exception) {
        throw Exception("Could not open ZIM archive: ${e.message}")
      }
    }

    AsyncFunction("getArticle") { path: String ->
      val archive = currentArchive ?: throw Exception("No archive open")
      try {
        val entry = archive.getEntryByPath(path)
        val article = mapOf(
          "html" to entry.content.toString(Charsets.UTF_8),
          "mimeType" to entry.mimeType,
          "finalPath" to entry.path,
          "title" to entry.title
        )
        return@AsyncFunction article
      } catch (e: Exception) {
        throw Exception("Article not found: ${e.message}")
      }
    }

    AsyncFunction("search") { query: String, limit: Int ->
      val archive = currentArchive ?: throw Exception("No archive open")
      try {
        // Simple suggestion search for now as a base implementation
        val suggestions = archive.suggest(query, limit.toLong())
        val results = suggestions.map { suggestion ->
          val entry = archive.getEntryByTitle(suggestion)
          mapOf(
            "path" to entry.path,
            "title" to entry.title,
            "snippet" to "" // Libkiwix snippets need full text index which might be huge
          )
        }
        return@AsyncFunction results
      } catch (e: Exception) {
        return@AsyncFunction emptyList<Map<String, String>>()
      }
    }

    AsyncFunction("suggest") { prefix: String, limit: Int ->
      val archive = currentArchive ?: throw Exception("No archive open")
      try {
        val suggestions = archive.suggest(prefix, limit.toLong())
        val results = suggestions.map { suggestion ->
          val entry = archive.getEntryByTitle(suggestion)
          mapOf(
            "path" to entry.path,
            "title" to entry.title
          )
        }
        return@AsyncFunction results
      } catch (e: Exception) {
        return@AsyncFunction emptyList<Map<String, String>>()
      }
    }
  }

  private fun getMetadataMap(): Map<String, Any?> {
    val archive = currentArchive ?: return emptyMap()
    return mapOf(
      "id" to (currentArchivePath?.hashCode()?.toString() ?: ""),
      "title" to archive.title,
      "description" to archive.description,
      "language" to archive.language,
      "articleCount" to archive.articleCount,
      "mainPath" to archive.mainEntry.path
    )
  }
}
