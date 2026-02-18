import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for backend operations
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "⚠️  Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env for image uploads.",
  );
}

// Storage bucket name for service images
export const SERVICE_IMAGES_BUCKET = "service-images";

/**
 * Upload an image buffer to Supabase Storage
 * @param buffer The file buffer
 * @param fileName The original filename
 * @param serviceId The service ID to organize the file
 * @param mimeType The file's MIME type
 * @returns The public URL of the uploaded image
 */
export async function uploadServiceImage(
  buffer: Buffer,
  fileName: string,
  serviceId: string,
  mimeType: string,
): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env",
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${serviceId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(SERVICE_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(SERVICE_IMAGES_BUCKET).getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Delete an image from Supabase Storage
 * @param imageUrl The public URL of the image to delete
 */
export async function deleteServiceImage(imageUrl: string): Promise<void> {
  if (!supabase) {
    console.warn("Supabase is not configured. Cannot delete image.");
    return;
  }

  try {
    // Extract the path from the public URL
    // URL format: https://<project>.supabase.co/storage/v1/object/public/service-images/<path>
    const urlParts = imageUrl.split(`${SERVICE_IMAGES_BUCKET}/`);
    if (urlParts.length < 2) {
      console.warn("Could not extract path from image URL:", imageUrl);
      return;
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(SERVICE_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.warn("Failed to delete image:", error.message);
    }
  } catch (error) {
    console.warn("Error deleting image:", error);
  }
}

// Provider documents bucket
export const PROVIDER_DOCS_BUCKET = "provider-documents";

/**
 * Upload a file to Supabase Storage (generic upload)
 * @param buffer The file buffer
 * @param storagePath Full storage path including filename
 * @param mimeType The file's MIME type
 * @param bucket The bucket name (defaults to service-images)
 * @returns The public URL of the uploaded file
 */
export async function uploadToSupabase(
  buffer: Buffer,
  storagePath: string,
  mimeType: string,
  bucket: string = SERVICE_IMAGES_BUCKET,
): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env",
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Delete a file from Supabase Storage (generic delete)
 * @param fileUrl The public URL of the file to delete
 */
export async function deleteFromSupabase(fileUrl: string): Promise<void> {
  if (!supabase) {
    console.warn("Supabase is not configured. Cannot delete file.");
    return;
  }

  try {
    // Try to detect bucket from URL
    let bucket = SERVICE_IMAGES_BUCKET;
    let filePath = "";

    if (fileUrl.includes(PROVIDER_DOCS_BUCKET)) {
      bucket = PROVIDER_DOCS_BUCKET;
      const urlParts = fileUrl.split(`${PROVIDER_DOCS_BUCKET}/`);
      filePath = urlParts[1] || "";
    } else if (fileUrl.includes(SERVICE_IMAGES_BUCKET)) {
      bucket = SERVICE_IMAGES_BUCKET;
      const urlParts = fileUrl.split(`${SERVICE_IMAGES_BUCKET}/`);
      filePath = urlParts[1] || "";
    }

    if (!filePath) {
      console.warn("Could not extract path from file URL:", fileUrl);
      return;
    }

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.warn("Failed to delete file:", error.message);
    }
  } catch (error) {
    console.warn("Error deleting file:", error);
  }
}
