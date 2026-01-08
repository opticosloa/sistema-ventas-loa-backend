// src/helpers/cloudinaryUploader.ts
import fs from "fs";
import cloudinary from "../api/cloudinary";

interface FileInput {
    buffer?: Buffer;
    tempFilePath?: string;
    path?: string; // para integración con sharp o paths locales
}

interface CloudinaryResult {
    url: string | undefined;
    public_id: string | undefined;
}

export const cloudinaryUploader = async (file: FileInput, folder = "prescriptions"): Promise<CloudinaryResult> => {
    try {
        let uploadSource: string;

        // 1. Determinar origen de la imagen
        if (file.tempFilePath) {
            uploadSource = file.tempFilePath;
        } else if (file.path) {
            uploadSource = file.path;
        } else if (file.buffer) {
            // Si viene como buffer (multer memory storage)
            // Subimos usando "upload_stream"
            return await new Promise<CloudinaryResult>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder },
                    (err, result) => {
                        if (err) return reject(new Error("Cloudinary error"));
                        resolve({
                            url: result?.secure_url,
                            public_id: result?.public_id,
                        });
                    }
                );
                stream.end(file.buffer);
            });
        } else {
            throw new Error("No se encontró un archivo válido para subir");
        }

        // 2. Subir desde un archivo temporal existente
        const result = await cloudinary.uploader.upload(uploadSource, { folder });

        // 3. Borrar archivo temporal si corresponde
        if (fs.existsSync(uploadSource)) fs.unlinkSync(uploadSource);

        return {
            url: result.secure_url,
            public_id: result.public_id,
        };
    } catch (error) {
        // En caso de error, intentar eliminar archivo temporal
        if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
            fs.unlinkSync(file.tempFilePath);
        }
        if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        throw new Error("Error al subir imagen a Cloudinary");
    }
};
