import axios from "axios";
import logger from "../../utils/logger";

export interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  url: string;
}

/**
 * Extrai metadados Open Graph de uma URL
 * Busca title, description e image (og:image)
 */
export const getLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  try {
    logger.info(`[LinkPreview] Buscando metadados para: ${url}`);

    // Fazer requisição com timeout curto
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;

    // Extrair title
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);

    // Extrair description
    const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i) ||
                      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

    // Extrair image
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

    const title = titleMatch ? titleMatch[1].trim() : url;
    const description = descMatch ? descMatch[1].trim() : '';
    let image = imageMatch ? imageMatch[1].trim() : '';

    // Se a imagem for relativa, converter para absoluta
    if (image && !image.startsWith('http')) {
      const baseUrl = new URL(url);
      image = image.startsWith('/') 
        ? `${baseUrl.protocol}//${baseUrl.host}${image}`
        : `${baseUrl.protocol}//${baseUrl.host}/${image}`;
    }

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
