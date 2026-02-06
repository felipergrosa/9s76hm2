import { getBackendUrl } from "../config";

export const getMediaUrl = (urlPicture) => {
  if (!urlPicture) {
    const backendUrl = getBackendUrl();
    // Se backendUrl é undefined ou vazio, retorna null para trigger fallback
    if (!backendUrl || backendUrl === 'undefined') {
      return null;
    }
    return `${backendUrl}/nopicture.png`;
  }
  
  // O modelo Contact já retorna a URL completa no getter urlPicture
  // Então apenas retornamos como está
  return urlPicture;
};
