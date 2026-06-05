import { useEffect, useMemo } from "react";
import avatarCache from "../utils/avatarCache";
import { getContactAvatarUrls } from "../components/ContactAvatar";

const collectUniqueAvatarUrls = (items) => {
  const urls = new Set();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const avatarUrls = getContactAvatarUrls(item);
    avatarUrls.forEach((url) => {
      if (url) {
        urls.add(url);
      }
    });
  });

  return [...urls];
};

const useAvatarPrefetch = (items) => {
  const urls = useMemo(() => collectUniqueAvatarUrls(items), [items]);

  useEffect(() => {
    if (urls.length === 0) return;
    avatarCache.primeMany(urls);
  }, [urls]);
};

export default useAvatarPrefetch;
