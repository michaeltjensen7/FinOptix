import { Pinecone } from '@pinecone-database/pinecone';
import { PINECONE_TOP_K, PINECONE_INDEX_NAME } from '@/config';
import { searchResultsToChunks, getSourcesFromChunks, getContextFromSources } from '@/lib/sources';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set');
}

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const pineconeIndex = pinecone.Index(PINECONE_INDEX_NAME);

type PineconeToolResult =
  | { kind: 'image'; image_url: string; caption?: string; source_name?: string }
  | { kind: 'text'; text: string };

export async function searchPinecone(query: string): Promise<PineconeToolResult> {
  const results = await pineconeIndex.namespace('default').searchRecords({
    query: {
      inputs: { text: query },
      topK: PINECONE_TOP_K,
    },
    // IMPORTANT: request image_url (and whatever you used to store name/description)
    fields: [
  'text',
  'pre_context',
  'post_context',
  'source_url',
  'source_description',
  'source_type',
  'order',
  'image_url',       // ADD THIS
  'image_name',      // optional, only if you stored it
  'source_name',     // optional
],
  });

  // Helpful logs while debugging (check Vercel logs)
  const top = (results as any)?.result?.hits?.[0] ?? (results as any)?.matches?.[0];
  console.log('PINECONE TOP HIT:', top);

  // Convert to your existing chunk/source pipeline
  const chunks = searchResultsToChunks(results);
const sources = getSourcesFromChunks(chunks);

let context = getContextFromSources(sources);

// Try to find an image URL in the results
const imageSource = sources.find((s: any) => s.image_url);

if (imageSource?.image_url) {
  const caption =
    imageSource.source_description ||
    imageSource.text ||
    "Image";

  context += `\n\n![${caption}](${imageSource.image_url})\n\nDirect link: ${imageSource.image_url}`;
}

return `< results > ${context} </results>`};
}
