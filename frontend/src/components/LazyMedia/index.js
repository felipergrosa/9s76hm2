import React, { useState, useEffect, useRef } from "react";

const LazyMedia = ({ children, placeholder, threshold = 0.1, rootMargin = "200px" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return (
    <div ref={containerRef} style={{ minHeight: "100px", width: "100%" }}>
      {isVisible ? children : (placeholder || <div style={{ height: "100px", backgroundColor: "#f0f0f0", borderRadius: "8px" }} />)}
    </div>
  );
};

export default LazyMedia;
