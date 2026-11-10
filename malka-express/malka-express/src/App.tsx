export async function submitRequest(
  input: { type: DocumentType; description: string; quantity: number; files: File[] },
  userId: string,
): Promise<void> {
  const invalid = validateFiles(input.files);
  if (invalid) throw new AppError(invalid);

  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_document_type: input.type,
    p_description: input.description,
    p_quantity: input.quantity,
  });
  if (error) throw toAppError(error);

  const id = orderId as string;
  const uploaded: string[] = [];
  try {
    for (const file of input.files) {
      const path = `${id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new AppError('upload_failed');
      uploaded.push(path);

      const { error: metaError } = await supabase.from('order_documents').insert({
        order_id: id,
        uploaded_by: userId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
      });
      if (metaError) throw new AppError('upload_failed');
    }
  } catch (e) {
    if (uploaded.length) await supabase.storage.from(DOCUMENTS_BUCKET).remove(uploaded);
    await supabase.rpc('cancel_order', { p_order_id: id });
    throw toAppError(e);
  }
}
