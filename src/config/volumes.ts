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
      title: "Security Research",
      listLabel: "Volume 0 - Security Research",
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
      ]
    }
  ],
  [
    1,
    {
      title: "Historical Philes",
      listLabel: "Volume 1 - Historical Philes",
      postscript: [
        "  ──[ EOF ]──────────────────────────────────────────────────────────────────//───",
        "",
        "  Life can only be understood backwards;",
        "  but it must be lived forwards.",
        "",
        "  Søren Kierkegaard"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryPrefix: "A"
    }
  ],
  [
    2,
    {
      title: "Year-End Wrap-ups",
      listLabel: "Volume 2 - Year-End Wrap-ups",
      postscript: [
        "  ──[ 0x146 ]────────────────────────────────────────────────────────────────//───",
        "",
        "  Let this be my last word,",
        "  that I trust in thy love.",
        "",
        "  Tagore, Stray Birds"
      ],
      phileSort: {
        by: "date",
        direction: "desc"
      },
      entryLabel: "year"
    }
  ],
  [
    3,
    {
      title: "Chromatic Philes",
      listLabel: "Volume 3 - Chromatic Philes",
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
