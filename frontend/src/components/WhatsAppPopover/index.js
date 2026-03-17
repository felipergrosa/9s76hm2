import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Popover,
  Paper,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Grid,
  CircularProgress,
  makeStyles,
  Tooltip,
} from '@material-ui/core';
import {
  EmojiEmotions,
  Gif,
  Face,
  Search,
  Close,
  History,
  SportsBasketball,
  EmojiNature,
  EmojiFoodBeverage,
  EmojiTransportation,
  EmojiSymbols,
  EmojiFlags,
  EmojiPeople,
} from '@material-ui/icons';
import axios from 'axios';
import { Smile } from 'lucide-react';

// Categorias de emoji
const EMOJI_CATEGORIES = [
  { id: 'recentes', icon: History, label: 'Recentes' },
  { id: 'pessoas', icon: EmojiPeople, label: 'Smileys e pessoas' },
  { id: 'animais', icon: EmojiNature, label: 'Animais e natureza' },
  { id: 'comidas', icon: EmojiFoodBeverage, label: 'Comidas e bebidas' },
  { id: 'atividades', icon: SportsBasketball, label: 'Atividades' },
  { id: 'viagens', icon: EmojiTransportation, label: 'Viagens e lugares' },
  { id: 'objetos', icon: EmojiSymbols, label: 'Objetos' },
  { id: 'simbolos', icon: EmojiSymbols, label: 'Símbolos' },
  { id: 'bandeiras', icon: EmojiFlags, label: 'Bandeiras' },
];

// Emojis comuns organizados por categoria
const COMMON_EMOJIS = {
  recentes: [], // Será populado do localStorage
  pessoas: [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
    '😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨',
    '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
    '🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁',
    '☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
    '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹',
    '👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👶','👧',
    '🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️',
  ],
  animais: [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵',
    '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗',
    '🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎',
    '🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅',
    '🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖',
    '🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦚','🦜','🦢',
  ],
  comidas: [
    '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🍍','🥭','🥥','🥝',
    '🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞',
    '🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟',
    '🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛',
    '🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦',
    '🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼',
  ],
  atividades: [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
    '🏏','🥅','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️',
    '🏂','🏋️‍♀️','🏋️','🏋️‍♂️','🤼‍♀️','🤼','🤼‍♂️','🤸‍♀️','🤸','🤸‍♂️','⛹️‍♀️','⛹️','⛹️‍♂️','🤺','🤾‍♀️','🤾',
    '🤾‍♂️','🏌️‍♀️','🏌️','🏌️‍♂️','🏇','🧘‍♀️','🧘','🧘‍♂️','🏄‍♀️','🏄','🏄‍♂️','🏊‍♀️','🏊','🏊‍♂️','🤽‍♀️','🤽',
    '🤽‍♂️','🚣‍♀️','🚣','🚣‍♂️','🧗‍♀️','🧗','🧗‍♂️','🚵‍♀️','🚵','🚵‍♂️','🚴‍♀️','🚴','🚴‍♂️','🏆','🥇','🥈',
    '🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹‍♀️','🤹','🤹‍♂️','🎭','🩰','🎨','🎬','🎤',
  ],
  viagens: [
    '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽',
    '🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋',
    '🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️',
    '🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','⛽','🚧','🚦','🚥','🚏',
    '🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋',
    '⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥',
  ],
  objetos: [
    '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼',
    '📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭',
    '⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸',
    '💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🧰','🔧','🔨','⚒️','🛠️','⛏️','🔩',
    '⚙️','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️',
    '🏺','🔮','📿','🧿','💎','🔔','🔕','📢','📣','📯','🔔','🎐','🎊','🎉','🎀','🎁',
  ],
  simbolos: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈',
    '♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴',
    '📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲',
    '🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷',
    '🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️',
  ],
  bandeiras: [
    '🏳️','🏴','🏴‍☠️','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🇺🇳','🇦🇫','🇦🇽','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮',
    '🇦🇶','🇦🇬','🇦🇷','🇦🇲','🇦🇼','🇦🇺','🇦🇹','🇦🇿','🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯',
    '🇧🇲','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇨🇻','🇰🇭','🇨🇲','🇨🇦','🇰🇾','🇨🇫',
    '🇹🇩','🇨🇱','🇨🇳','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇰','🇨🇷','🇨🇮','🇭🇷','🇨🇺','🇨🇼','🇨🇾','🇨🇿','🇩🇰',
    '🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇸🇿','🇪🇹','🇪🇺','🇫🇰','🇫🇴','🇫🇯','🇫🇮',
    '🇫🇷','🇬🇫','🇵🇫','🇹🇫','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇮','🇬🇷','🇬🇱','🇬🇩','🇬🇵','🇬🇺','🇬🇹',
  ],
};

// Categorias de GIFs populares (estilo WhatsApp)
const GIF_CATEGORIES = [
  { id: 'trending', label: 'Em alta', icon: '🔥' },
  { id: 'love', label: 'Amor', icon: '❤️' },
  { id: 'happy', label: 'Feliz', icon: '😄' },
  { id: 'sad', label: 'Triste', icon: '😢' },
  { id: 'funny', label: 'Engraçado', icon: '😂' },
  { id: 'reaction', label: 'Reação', icon: '👍' },
  { id: 'animals', label: 'Animais', icon: '🐱' },
  { id: 'sports', label: 'Esportes', icon: '⚽' },
];

const useStyles = makeStyles((theme) => ({
  popover: {
    '& .MuiPopover-paper': {
      width: 420,
      height: 350,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    },
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.palette.background.paper,
  },
  tabs: {
    minHeight: 40,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: 'none',
    order: 999,
    '& .MuiTabs-flexContainer': {
      justifyContent: 'space-around',
    },
    '& .MuiTab-root': {
      minWidth: 'auto',
      minHeight: 40,
      padding: '6px 20px',
      textTransform: 'none',
      fontSize: 0,
    },
    '& .Mui-selected': {
      color: '#00a884 !important',
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#00a884',
      height: 3,
      top: 0,
      bottom: 'auto',
    },
  },
  searchBar: {
    padding: '6px 12px',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  searchInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: 20,
      backgroundColor: theme.palette.mode === 'dark' ? '#2a3942' : '#f0f2f5',
      height: 32,
      '& fieldset': {
        border: 'none',
      },
      '&:hover fieldset': {
        border: 'none',
      },
      '&.Mui-focused fieldset': {
        border: 'none',
      },
    },
    '& .MuiOutlinedInput-input': {
      padding: '6px 12px',
      fontSize: 13,
    },
  },
  categoryBar: {
    display: 'flex',
    padding: '4px 8px',
    borderTop: `1px solid ${theme.palette.divider}`,
    overflowX: 'auto',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    scrollbarWidth: 'none',
    justifyContent: 'center',
  },
  categoryButton: {
    minWidth: 'auto',
    padding: '6px 10px',
    borderRadius: 20,
    fontSize: 12,
    marginRight: 4,
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.active': {
      backgroundColor: '#00a884',
      color: '#fff',
    },
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    paddingBottom: 0,
  },
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 4,
  },
  emojiButton: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    cursor: 'pointer',
    borderRadius: 8,
    transition: 'background-color 0.15s',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 4,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  gifGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 4,
  },
  gifItem: {
    position: 'relative',
    aspectRatio: '16/9',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: theme.palette.action.hover,
    '& img': {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    '&:hover': {
      opacity: 0.9,
    },
  },
  stickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
    padding: 8,
  },
  stickerItem: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    cursor: 'pointer',
    backgroundColor: theme.palette.action.hover,
    padding: 8,
    '& img': {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
    },
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
    padding: 24,
    textAlign: 'center',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
  },
  triggerButton: {
    padding: 6,
    color: '#000000',
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    padding: '8px 4px 4px',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  createSticker: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: '1',
    borderRadius: 8,
    border: `2px dashed ${theme.palette.divider}`,
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    fontSize: 12,
    '&:hover': {
      borderColor: '#00a884',
      color: '#00a884',
    },
  },
  recentEmoji: {
    fontSize: 24,
  },
}));

// Giphy API key pública (limitada, para produção usar uma própria)
const GIPHY_API_KEY = 'dc6zaTOxFJmzC';

const WhatsAppPopover = ({ onSelectEmoji, onSelectGif, onSelectSticker, disabled }) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('pessoas');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [favoriteStickers, setFavoriteStickers] = useState([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [gifCategory, setGifCategory] = useState('trending');
  const searchTimeout = useRef(null);

  // Carregar emojis recentes
  useEffect(() => {
    const saved = localStorage.getItem('whatsapp-recent-emojis');
    if (saved) {
      try {
        setRecentEmojis(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar emojis recentes:', e);
      }
    }
  }, []);

  // Carregar stickers favoritos
  useEffect(() => {
    const saved = localStorage.getItem('favoriteStickers');
    if (saved) {
      try {
        setFavoriteStickers(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar stickers favoritos:', e);
      }
    }
  }, []);

  // Sincronizar favoritos em realtime entre abas/janelas
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'favoriteStickers') {
        console.log('[WhatsAppPopover] Favoritos atualizados via storage event');
        const saved = localStorage.getItem('favoriteStickers');
        if (saved) {
          try {
            setFavoriteStickers(JSON.parse(saved));
          } catch (err) {
            console.error('Erro ao sincronizar stickers favoritos:', err);
          }
        } else {
          setFavoriteStickers([]);
        }
      }
    };

    // Listener para mudanças no localStorage de outras abas/janelas
    window.addEventListener('storage', handleStorageChange);

    // Listener para evento customizado (mesma janela)
    const handleCustomEvent = () => {
      console.log('[WhatsAppPopover] Favoritos atualizados via evento customizado');
      const saved = localStorage.getItem('favoriteStickers');
      if (saved) {
        try {
          setFavoriteStickers(JSON.parse(saved));
        } catch (err) {
          console.error('Erro ao sincronizar stickers favoritos:', err);
        }
      }
    };
    window.addEventListener('favoriteStickersUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('favoriteStickersUpdated', handleCustomEvent);
    };
  }, []);

  // Buscar GIFs trending ao abrir aba
  useEffect(() => {
    if (activeTab === 1) {
      console.log('Buscando GIFs trending...');
      fetchGifs('trending');
    }
  }, [activeTab]);

  // Buscar figurinhas
  useEffect(() => {
    if (activeTab === 2 && stickers.length === 0) {
      fetchStickers();
    }
  }, [activeTab]);

  // Debounce de busca
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (searchQuery.trim()) {
      searchTimeout.current = setTimeout(() => {
        if (activeTab === 1) {
          fetchGifs(searchQuery);
        }
      }, 500);
    } else if (activeTab === 1) {
      fetchGifs('trending');
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, activeTab]);

  const fetchGifs = async (query) => {
    setLoadingGifs(true);
    console.log('fetchGifs chamado com query:', query);
    try {
      // API Key do Giphy
      const apiKey = 'QufQENmjOMLKAJsnsEI1XvF8f6wXYxGj';
      
      const endpoint = query === 'trending'
        ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g&lang=pt`;

      console.log('Endpoint:', endpoint);
      const response = await axios.get(endpoint, { timeout: 10000 });
      
      console.log('GIFs encontrados:', response.data.data.length);
      setGifs(response.data.data);
    } catch (error) {
      console.error('Erro ao buscar GIFs:', error);
      setGifs([]);
    } finally {
      setLoadingGifs(false);
    }
  };

  const fetchStickers = async () => {
    setLoadingStickers(true);
    try {
      // Buscar figurinhas populares do Giphy
      const response = await axios.get(
        `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`
      );
      setStickers(response.data.data);
    } catch (error) {
      console.error('Erro ao buscar figurinhas:', error);
      // Fallback para figurinhas estáticas
      setStickers([]);
    } finally {
      setLoadingStickers(false);
    }
  };

  const handleOpen = (event) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchQuery('');
  };

  const handleEmojiClick = (emoji) => {
    // Salvar nos recentes
    const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 20);
    setRecentEmojis(newRecent);
    localStorage.setItem('whatsapp-recent-emojis', JSON.stringify(newRecent));

    if (onSelectEmoji) {
      onSelectEmoji(emoji);
    }
  };

  const handleGifClick = (gif) => {
    if (onSelectGif) {
      onSelectGif(gif.images.fixed_height.url);
    }
    handleClose();
  };

  const handleStickerClick = (sticker) => {
    if (onSelectSticker) {
      onSelectSticker(sticker.images.fixed_height.url);
    }
    handleClose();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSearchQuery('');
  };

  const renderEmojiContent = () => {
    const emojisToShow = selectedCategory === 'recentes'
      ? recentEmojis
      : COMMON_EMOJIS[selectedCategory] || [];

    if (selectedCategory === 'recentes' && recentEmojis.length === 0) {
      return (
        <div className={classes.emptyState}>
          <History style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }} />
          <div>Nenhum emoji recente</div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
            Os emojis que você usar aparecerão aqui
          </div>
        </div>
      );
    }

    return (
      <>
        <div className={classes.content}>
          <div className={classes.sectionTitle}>
            {EMOJI_CATEGORIES.find(c => c.id === selectedCategory)?.label}
          </div>
          <div className={classes.emojiGrid}>
            {emojisToShow.map((emoji, index) => (
              <button
                key={index}
                className={classes.emojiButton}
                onClick={() => handleEmojiClick(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div className={classes.categoryBar}>
          {EMOJI_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.id;
            return (
              <Tooltip key={category.id} title={category.label} arrow>
                <IconButton
                  className={`${classes.categoryButton} ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                  size="small"
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          })}
        </div>
      </>
    );
  };

  const renderGifContent = () => {
    if (loadingGifs) {
      return (
        <div className={classes.loading}>
          <CircularProgress size={32} />
        </div>
      );
    }

    return (
      <>
        <div className={classes.content}>
          {gifs.length === 0 ? (
            <div className={classes.emptyState}>
              <Gif style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }} />
              <div>Nenhum GIF encontrado</div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
                Tente buscar por outro termo
              </div>
            </div>
          ) : (
            <div className={classes.gifGrid}>
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  className={classes.gifItem}
                  onClick={() => handleGifClick(gif)}
                >
                  <img
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={classes.categoryBar}>
          {GIF_CATEGORIES.map((category) => (
            <Tooltip key={category.id} title={category.label} arrow>
              <IconButton
                className={`${classes.categoryButton} ${gifCategory === category.id ? 'active' : ''}`}
                onClick={() => {
                  setGifCategory(category.id);
                  fetchGifs(category.id === 'trending' ? 'trending' : category.id);
                }}
                size="small"
              >
                <span style={{ fontSize: 16 }}>{category.icon}</span>
              </IconButton>
            </Tooltip>
          ))}
        </div>
      </>
    );
  };

  const renderStickerContent = () => {
    if (loadingStickers) {
      return (
        <div className={classes.loading}>
          <CircularProgress size={32} />
        </div>
      );
    }

    return (
      <div className={classes.content}>
        {/* Seção de Favoritos */}
        {favoriteStickers.length > 0 && (
          <>
            <div className={classes.sectionTitle}>
              ⭐ Favoritos ({favoriteStickers.length})
            </div>
            <div className={classes.stickerGrid}>
              {favoriteStickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className={classes.stickerItem}
                  onClick={() => {
                    if (onSelectSticker) {
                      onSelectSticker(sticker.url);
                    }
                    handleClose();
                  }}
                >
                  <img
                    src={sticker.url}
                    alt="Favorito"
                    loading="lazy"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
          </>
        )}

        {/* Stickers da API */}
        <div className={classes.stickerGrid}>
          {stickers.length > 0 ? (
            stickers.map((sticker) => (
              <div
                key={sticker.id}
                className={classes.stickerItem}
                onClick={() => handleStickerClick(sticker)}
              >
                <img
                  src={sticker.images.fixed_height_small.url}
                  alt={sticker.title}
                  loading="lazy"
                />
              </div>
            ))
          ) : (
            <div className={classes.createSticker}>
              <span style={{ fontSize: 24, marginBottom: 4 }}>+</span>
              <span>Criar</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const showSearch = activeTab === 1 || activeTab === 2;

  return (
    <>
      <Tooltip title="Emojis, GIFs, Figurinhas">
        <IconButton
          className={classes.triggerButton}
          onClick={handleOpen}
          disabled={disabled}
          size="small"
        >
          <Smile size={20} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        className={classes.popover}
        PaperProps={{
          className: classes.container,
          style: { marginTop: -15 },
        }}
      >
        {showSearch && (
          <div className={classes.searchBar}>
            <TextField
              fullWidth
              placeholder={
                activeTab === 1
                  ? 'Pesquisar GIFs em GIPHY'
                  : 'Pesquisar na Loja de Figurinhas do WhatsApp'
              }
              variant="outlined"
              size="small"
              className={classes.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Search
                    fontSize="small"
                    style={{ marginRight: 8, opacity: 0.5 }}
                  />
                ),
                endAdornment: searchQuery && (
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    style={{ padding: 2 }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                ),
              }}
            />
          </div>
        )}

        {activeTab === 0 && renderEmojiContent()}
        {activeTab === 1 && renderGifContent()}
        {activeTab === 2 && renderStickerContent()}

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          className={classes.tabs}
          variant="fullWidth"
        >
          <Tab icon={<EmojiEmotions fontSize="small" />} />
          <Tab icon={<Gif fontSize="small" />} />
          <Tab icon={<Face fontSize="small" />} />
        </Tabs>
      </Popover>
    </>
  );
};

export default WhatsAppPopover;
