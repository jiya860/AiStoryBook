-- Add reference_image_url to notebooks for global style reference
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS reference_image_url text;

-- Create storage bucket for reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload reference images
CREATE POLICY "Users can upload reference images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reference-images');

-- Allow public read access
CREATE POLICY "Public read reference images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reference-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own reference images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reference-images');