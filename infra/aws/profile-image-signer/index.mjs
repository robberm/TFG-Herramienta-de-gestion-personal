// Lambda que firma URLs temporales para las fotos de perfil de GMO.
//
// El backend de GMO corre en el PC de cada usuario y no lleva claves de AWS. En su lugar
// llama a esta función (Function URL) con una clave compartida y recibe una URL firmada
// válida para UN fichero y pocos minutos. Las credenciales de S3 nunca salen de AWS.
//
// Variables de entorno de la Lambda:
//   BUCKET_NAME  -> bucket privado de fotos
//   SIGNER_KEY   -> clave compartida (la misma que PROFILE_IMAGES_SIGNER_KEY en gmo.env)
//
// Peticiones (POST, JSON, cabecera x-gmo-signer-key):
//   { "action": "upload",   "key": "...", "contentType": "image/png", "contentLength": 1234 } -> { "url": "..." }
//   { "action": "download", "key": "..." } -> { "url": "..." }
//   { "action": "delete",   "key": "..." } -> { "deleted": true }

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { timingSafeEqual } from "node:crypto";

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME;
const SIGNER_KEY = process.env.SIGNER_KEY || "";

// Solo se firman claves con el formato que genera el backend: nada de listar ni tocar otras rutas.
const KEY_PATTERN = /^profile-images\/user_\d+_\d+\.(png|jpg|jpeg|webp|gif)$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function isAuthorized(event) {
  const received = Buffer.from(event.headers?.["x-gmo-signer-key"] || "");
  const expected = Buffer.from(SIGNER_KEY);
  return expected.length > 0 && received.length === expected.length && timingSafeEqual(received, expected);
}

function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body;
  return JSON.parse(raw || "{}");
}

export const handler = async (event) => {
  if (!BUCKET) return json(500, { error: "BUCKET_NAME no configurado" });
  if (!isAuthorized(event)) return json(401, { error: "No autorizado" });

  let request;
  try {
    request = parseBody(event);
  } catch {
    return json(400, { error: "JSON no válido" });
  }

  const { action, key } = request;
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
    return json(400, { error: "Clave no permitida" });
  }

  if (action === "upload") {
    const { contentType, contentLength } = request;
    if (typeof contentType !== "string" || !contentType.startsWith("image/")) {
      return json(400, { error: "Tipo de contenido no permitido" });
    }
    if (!Number.isInteger(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
      return json(400, { error: "Tamaño no permitido (máximo 5 MB)" });
    }

    // content-type y content-length van firmados: S3 rechaza subidas que no coincidan.
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return json(200, { url });
  }

  if (action === "download") {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
    return json(200, { url });
  }

  if (action === "delete") {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return json(200, { deleted: true });
  }

  return json(400, { error: "Acción no soportada" });
};
