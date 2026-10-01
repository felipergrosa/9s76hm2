// Normaliza o valor do campo social do contato (handle, @user ou URL)
// em uma URL de perfil válida. Retorna null quando não há valor.
const buildProfileUrl = (value, domain) => {
    if (!value || typeof value !== "string") return null;
    const v = value.trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    const handle = v.replace(/^@+/, "").replace(/\/+$/, "");
    if (!handle) return null;
    return `https://${domain}/${handle}`;
};

export const instagramProfileUrl = (value) => buildProfileUrl(value, "instagram.com");
export const facebookProfileUrl = (value) => buildProfileUrl(value, "facebook.com");
