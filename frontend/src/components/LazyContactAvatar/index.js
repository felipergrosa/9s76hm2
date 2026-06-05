import React, { memo } from "react";
import ContactAvatar from "../ContactAvatar";

const LazyContactAvatar = ({ contact, className, style, ...props }) => {
  return (
    <ContactAvatar
      contact={contact}
      className={className}
      style={style}
      {...props}
    />
  );
};

export default memo(LazyContactAvatar);
