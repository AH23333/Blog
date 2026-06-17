export type HomeItem = {
  label: string;
  href?: string;
  linkLabel?: string;
  external?: boolean;
  prefix?: string;
};

export type HomeSection = {
  title: string;
  items?: HomeItem[];
  volumes?: {
    include?: number[];
    exclude?: number[];
    sort?: "asc" | "desc";
    showEmpty?: boolean;
  };
};

export type SiteConfig = {
  name: string;
  description: string;
  homeAsciiArt: string;
  homeSections: HomeSection[];
};

export const siteConfig: SiteConfig = {
  name: "AH's Blog",
  description: "Security Research Philes",
  homeAsciiArt: `    ___    __  ___          ____  __
   /   |  / / / ( )_____   / __ )/ /___  ____ _
  / /| | / /_/ /|// ___/  / __  / / __ \\/ __ \`/
 / ___ |/ __  /  (__  )  / /_/ / / /_/ / /_/ /
/_/  |_/_/ /_/  /____/  /_____/_/\\____/\\__, /
                                      /____/`,
  homeSections: [
    {
      title: "AH's Blog",
      items: [
        {
          label: "Welcome"
        },
        // {
        //   label: "Researcher @RaptX",
        //   linkLabel: "@RaptX",
        //   href: "https://raptx.org/",
        //   external: true
        // }
      ]
    },
    {
      title: "Philes",
      volumes: {
        sort: "asc",
        showEmpty: false
      }
    },
    // {
    //   title: "Research",
    //   items: [
    //     { label: "Binary Exploitation" },
    //     { label: "Windows Security" },
    //     { label: "IoT Security" },
    //     { label: "Automation" }
    //   ]
    // },
    {
      title: "Contact",
      items: [
        {
          label: "github@AH23333",
          href: "https://github.com/AH23333/",
          external: true,
          prefix: "~ call"
        },
        {
          label: "bilibili@安好_AH",
          href: "https://space.bilibili.com/475905230",
          external: true,
          prefix: "~ call"
        },
        
      ]
    }
  ]
};
