import axios from "axios";
import sharp from "sharp";
import logger from "../../utils/logger";

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  url: string;
}

interface InstagramOEmbedResponse {
  title?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
}

interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  provider_name?: string;
}

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
};

const IMAGE_REQUEST_HEADERS = {
  ...REQUEST_HEADERS,
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
};

const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const MIN_ENHANCED_WIDTH = 640;
const INSTAGRAM_OEMBED_RETRY_DELAYS_MS = [0, 250, 800];
const YOUTUBE_THUMBNAIL_VARIANTS = [
  "maxresdefault.jpg",
  "sddefault.jpg",
  "hqdefault.jpg",
  "mqdefault.jpg",
  "default.jpg"
];

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const cleanValue = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return decodeHtml(value).trim();
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const parseDataImage = (
  value?: string | null
): { mimeType: string; buffer: Buffer } | null => {
  const normalized = cleanValue(value);

  if (!normalized.startsWith("data:image/")) {
    return null;
  }

  const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
};

const getAbsoluteImageUrl = (url: string, image: string): string => {
  if (!image || image.startsWith("http") || image.startsWith("data:image")) {
    return image;
  }

  const baseUrl = new URL(url);

  return image.startsWith("/")
    ? `${baseUrl.protocol}//${baseUrl.host}${image}`
    : `${baseUrl.protocol}//${baseUrl.host}/${image}`;
};

const matchMetaContent = (html: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = cleanValue(match?.[1]);

    if (value) {
      return value;
    }
  }

  return "";
};

const isInstagramUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return /(^|\.)instagram\.com$/i.test(parsed.hostname) || /(^|\.)instagr\.am$/i.test(parsed.hostname);
  } catch (error) {
    return false;
  }
};

const isYouTubeUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be" ||
      hostname.endsWith(".youtu.be") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    );
  } catch (error) {
    return false;
  }
};

const extractYouTubeVideoId = (url: string): string => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
      return cleanValue(pathParts[0]);
    }

    if (parsed.searchParams.get("v")) {
      return cleanValue(parsed.searchParams.get("v"));
    }

    const markerIndex = pathParts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
    if (markerIndex >= 0) {
      return cleanValue(pathParts[markerIndex + 1]);
    }

    return "";
  } catch (error) {
    return "";
  }
};

const findFirstAvailableImageUrl = async (candidates: string[]): Promise<string> => {
  for (const candidate of candidates) {
    try {
      const response = await axios.head(candidate, {
        timeout: 10000,
        headers: IMAGE_REQUEST_HEADERS,
        validateStatus: status => status >= 200 && status < 300
      });

      const contentType = cleanValue(response.headers["content-type"]);
      if (contentType && !contentType.toLowerCase().startsWith("image/")) {
        continue;
      }

      return candidate;
    } catch (error) {
      // Tentamos a próxima variante disponível.
    }
  }

  return "";
};

const normalizeInstagramUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  return parsed.toString();
};

const getInstagramPreview = async (url: string): Promise<LinkPreviewData | null> => {
  const canonicalUrl = normalizeInstagramUrl(url);

  for (let attempt = 0; attempt < INSTAGRAM_OEMBED_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = INSTAGRAM_OEMBED_RETRY_DELAYS_MS[attempt];

    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      const { data } = await axios.get<InstagramOEmbedResponse>(
        "https://www.instagram.com/api/v1/oembed/",
        {
          timeout: 10000,
          headers: REQUEST_HEADERS,
          params: {
            url: canonicalUrl
          },
          validateStatus: responseStatus => responseStatus >= 200 && responseStatus < 300
        }
      );

      const image = cleanValue(data?.thumbnail_url);
      const title = cleanValue(data?.provider_name) || "Instagram";
      const description =
        cleanValue(data?.title) ||
        (cleanValue(data?.author_name) ? `@${cleanValue(data?.author_name)}` : "");

      if (!image && !description) {
        return null;
      }

      return {
        title,
        description,
        image,
        url: canonicalUrl
      };
    } catch (error) {
      // O oEmbed do Instagram é intermitente; tentamos novamente antes de cair no parser genérico.
    }
  }

  return null;
};

const getYouTubePreview = async (url: string): Promise<LinkPreviewData | null> => {
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  let title = "YouTube";
  let description = "";

  try {
    const { data } = await axios.get<YouTubeOEmbedResponse>(
      "https://www.youtube.com/oembed",
      {
        timeout: 10000,
        headers: REQUEST_HEADERS,
        params: {
          url,
          format: "json"
        },
        validateStatus: status => status >= 200 && status < 300
      }
    );

    title = cleanValue(data?.title) || cleanValue(data?.provider_name) || title;
    description = cleanValue(data?.author_name);
  } catch (error) {
    // Se o oEmbed falhar, ainda tentamos a thumbnail direta pelo videoId.
  }

  const image =
    (await findFirstAvailableImageUrl(
      YOUTUBE_THUMBNAIL_VARIANTS.map(
        variant => `https://i.ytimg.com/vi/${videoId}/${variant}`
      )
    )) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    title,
    description,
    image,
    url
  };
};

export const resolvePreviewImage = async (imageUrl?: string | null): Promise<string> => {
  const normalizedUrl = cleanValue(imageUrl);

  if (!normalizedUrl || normalizedUrl === "no-image" || normalizedUrl.startsWith("data:image")) {
    return normalizedUrl;
  }

  if (!isHttpUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  try {
    const response = await axios.get<ArrayBuffer>(normalizedUrl, {
      timeout: 15000,
      responseType: "arraybuffer",
      headers: IMAGE_REQUEST_HEADERS,
      validateStatus: status => status >= 200 && status < 300
    });

    const contentType = cleanValue(response.headers["content-type"]) || "image/jpeg";

    if (!contentType.toLowerCase().startsWith("image/")) {
      return normalizedUrl;
    }

    const buffer = Buffer.from(response.data);

    if (buffer.byteLength > MAX_INLINE_IMAGE_BYTES) {
      logger.warn(
        `[LinkPreview] Imagem excede o limite inline (${buffer.byteLength} bytes): ${normalizedUrl}`
      );
      return normalizedUrl;
    }

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    logger.warn(`[LinkPreview] Não foi possível inline a imagem ${normalizedUrl}: ${error.message}`);
    return normalizedUrl;
  }
};

export const enhancePreviewImage = async (image?: string | null): Promise<string> => {
  const parsed = parseDataImage(image);

  if (!parsed) {
    return cleanValue(image);
  }

  try {
    const metadata = await sharp(parsed.buffer).metadata();
    const originalWidth = metadata.width || 0;

    if (originalWidth >= MIN_ENHANCED_WIDTH) {
      return cleanValue(image);
    }

    const outputBuffer = await sharp(parsed.buffer)
      .resize({
        width: MIN_ENHANCED_WIDTH,
        fit: "inside",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3
      })
      .sharpen({ sigma: 1.2, m1: 1.2, m2: 2 })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${outputBuffer.toString("base64")}`;
  } catch (error) {
    logger.warn(`[LinkPreview] Não foi possível melhorar miniatura inline: ${error.message}`);
    return cleanValue(image);
  }
};

/**
 * Extrai metadados Open Graph de uma URL
 * Busca title, description e image (og:image)
 */
export const getLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    if (isInstagramUrl(url)) {
      const instagramPreview = await getInstagramPreview(url);

      if (instagramPreview) {
        return instagramPreview;
      }
    }

    if (isYouTubeUrl(url)) {
      const youtubePreview = await getYouTubePreview(url);

      if (youtubePreview) {
        return youtubePreview;
      }
    }

    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: REQUEST_HEADERS
    });

    const html = String(response.data || "");

    const title =
      matchMetaContent(html, [
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i,
        /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:title["'][^>]*>/i,
        /<title[^>]*>([^<]+)<\/title>/i
      ]) || url;

    const description = matchMetaContent(html, [
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i,
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:description["'][^>]*>/i
    ]);

    const image = getAbsoluteImageUrl(
      url,
      matchMetaContent(html, [
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
        /<meta[^>]*property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["'][^>]*>/i,
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i
      ])
    );

    if (!title && !image) {
      return null;
    }

    return {
      title,
      description,
      image,
      url
    };

  } catch (error) {
    logger.error(`[LinkPreview] Erro ao buscar metadados: ${error.message}`);
    return null;
  }
};

/**
 * Detecta URLs em um texto
 * Retorna a primeira URL encontrada ou null
 */
export const detectUrl = (text: string): string | null => {
  if (!text) return null;
  
  // Regex para detectar URLs
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  
  return match ? match[1] : null;
};

/**
 * Gera string de preview no formato usado pelo sistema
 * Formato: image | sourceUrl | title | description | messageText
 */
export const generateLinkPreviewString = async (
  messageText: string
): Promise<string | null> => {
  const url = detectUrl(messageText);
  
  if (!url) {
    return null;
  }

  const preview = await getLinkPreview(url);
  
  if (!preview) {
    return null;
  }

  // Formato: image | sourceUrl | title | description | messageText
  const parts = [
    preview.image || 'no-image',
    preview.url,
    preview.title || '',
    preview.description || '',
    messageText
  ];

  return parts.join(' | ');
};
