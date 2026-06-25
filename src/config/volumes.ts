export type VolumePhileSort = {
  by: "date" | "order";
  direction: "asc" | "desc";
};

export type VolumeConfig = {
  title: string;
  subtitle?: string;
  listLabel: string;
  postscript?: string[];
  entryPrefix?: string;
  entryLabel?: "index" | "year";
  reverseEntryNumbers?: boolean;
  phileSort?: VolumePhileSort;
};

export const defaultVolumeConfig = (number: number): VolumeConfig => ({
  title: `Entropic Volume ${number}`,
  listLabel: `Volume ${number}`,
  phileSort: {
    by: "date",
    direction: "desc"
  },
  postscript: ["  ──[ EOF ]──────────────────────────────────────────────────────────────────//───"]
});

export const volumeConfigs = new Map<number, VolumeConfig>([
  [
    0,
    {
      title: "Function Test Articles and Syntax Explanation",
      listLabel: "Volume 0 - 功能测试文章及语法解释",
      phileSort: {
        by: "order",
        direction: "asc"
      },
      postscript: [
        "  ──[ 0x51 ]─────────────────────────────────────────────────────────────────//───",
        "",
        "  What is this unseen flame of darkness whose sparks are the stars?",
        "",
        "  Tagore, Stray Birds"
      ],
      entryPrefix: "T"
    }
  ],
  [
    1,
    {
      title: "Historical Philes",
      listLabel: "Volume 1 - 往期文章",
      postscript: [
        "  ──[ EOF ]──────────────────────────────────────────────────────────────────//───",
        "",
        "  Life can only be understood backwards;",
        "  but it must be lived forwards.",
        "",
        "  Søren Kierkegaard"
      ],
      phileSort: {
        by: "order",
        direction: "asc"
      },
      entryPrefix: "A"
    }
  ],
  [
    2,
    {
      title: "Experience Articles",
      listLabel: "Volume 2 - 经验之谈",
      postscript: [
        "  ──[ 0x146 ]────────────────────────────────────────────────────────────────//───",
        "",
        "  Let this be my last word,",
        "  that I trust in thy love.",
        "",
        "  Tagore, Stray Birds"
      ],
      phileSort: {
        by: "order",
        direction: "asc"
      },
      entryPrefix: "E"
      // entryLabel: "year"
    }
  ],
  [
    3,
    {
      title: "Chromatic Articles and ANSI Explanation",
      listLabel: "Volume 3 - 彩色文章及ANSI解释",
      postscript: [
        "  ──[ SGR ]──────────────────────────────────────────────────────────────────//───",
        "",
        "  Color is only another byte of pressure",
        "  applied to a line that was already executable.",
        "",
        "  Entropic notes"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryPrefix: "C"
    }
  ]
]);

export function volumeConfig(number: number): VolumeConfig {
  return volumeConfigs.get(number) ?? defaultVolumeConfig(number);
}
