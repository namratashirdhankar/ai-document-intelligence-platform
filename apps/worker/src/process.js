export async function processDocument({ documentId, filePath }, { pool, ocrUrl, llmUrl, fetchFn = fetch }) {
  await pool.query("UPDATE documents SET status='processing', updated_at=NOW() WHERE id=$1", [documentId]);
  try {
    const fileBuffer = await import('node:fs/promises').then(fs => fs.readFile(filePath));
    const ocrResponse = await fetchFn(`${ocrUrl}/ocr`, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: fileBuffer
    });
    if (!ocrResponse.ok) throw new Error(`OCR failed: ${ocrResponse.status}`);
    const { text } = await ocrResponse.json();

    const llmResponse = await fetchFn(`${llmUrl}/extract`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text })
    });
    if (!llmResponse.ok) throw new Error(`LLM failed: ${llmResponse.status}`);
    const result = await llmResponse.json();

    await pool.query("UPDATE documents SET status='completed', ocr_text=$2, result=$3, updated_at=NOW() WHERE id=$1", [documentId, text, result]);
    return result;
  } catch (err) {
    await pool.query("UPDATE documents SET status='failed', error=$2, updated_at=NOW() WHERE id=$1", [documentId, String(err.message || err)]);
    throw err;
  }
}
