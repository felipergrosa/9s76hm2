import axios from "axios";
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

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
};

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

const normalizeInstagramUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  return parsed.toString();
};

const getInstagramPreview = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    const canonicalUrl = normalizeInstagramUrl(url);
    const { data, status } = await axios.get<InstagramOEmbedResponse>(
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

    logger.info(`[LinkPreview] Instagram oEmbed encontrado para: ${canonicalUrl}`);

    return {
      title,
      description,
      image,
      url: canonicalUrl
    };
  } catch (error) {
    logger.warn(`[LinkPreview] Instagram oEmbed indisponível para ${url}: ${error.message}`);
    return null;
  }
};

/**
 * Extrai metadados Open Graph de uma URL
 * Busca title, description e image (og:image)
 */
export const getLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    logger.info(`[LinkPreview] Buscando metadados para: ${url}`);

    if (isInstagramUrl(url)) {
      const instagramPreview = await getInstagramPreview(url);

      if (instagramPreview) {
        return instagramPreview;
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

    logger.info(`[LinkPreview] Metadados extraídos: title=${title ? 'SIM' : 'NÃO'}, desc=${description ? 'SIM' : 'NÃO'}, image=${image ? 'SIM' : 'NÃO'}`);

    if (!title && !image) {
      logger.info(`[LinkPreview] Nenhum metadado útil encontrado`);
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
