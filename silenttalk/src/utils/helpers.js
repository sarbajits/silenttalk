import { formatDistanceToNow, format } from 'date-fns';

export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffInDays < 1) {
    return format(date, 'HH:mm');
  } else if (diffInDays < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    return format(date, 'dd/MM/yyyy');
  }
};

export const getAvatarUrl = (username) => {
  return `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(username)}&size=128`;
};

export const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
}; 