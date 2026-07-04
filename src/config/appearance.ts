export type AppearanceConfig = {
  colors: {
    background: string;
    homeBackground: string;
    foreground: string;
    link: string;
    linkHover: string;
    linkHoverBackground: string;
  };
  fonts: {
    asciiFamily: string;
    asciiUrl: string;
    asciiFormat: string;
  };
  sizing: {
    textSize: string;
    cjkSize: string;
    cjkLinkSize: string;
    textCell: string;
    cjkScale: string;
    homeSize: string;
  };
};

export const appearanceConfig: AppearanceConfig = {
  colors: {
    background: "#0c0d10",
    homeBackground: "#0a0b11",
    foreground: "#fefefe",
    link: "#93ffd7",
    linkHover: "#c7ffe9",
    linkHoverBackground: "#153329"
  },
  fonts: {
    asciiFamily: "gohu",
    asciiUrl: "/fonts/gohu-subset.woff",
    asciiFormat: "woff"
  },
  sizing: {
    textSize: "21px",
    cjkSize: "20px",
    cjkLinkSize: "22px",
    textCell: "12px",
    cjkScale: "1.5",
    homeSize: "21px"
  }
};
