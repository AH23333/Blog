type BootstrapOptions = {
  mobileFitBreakpoint: number;
};

export function installTextmodeBootstrap(options = readOptions()): void {
  installMobileFit(options.mobileFitBreakpoint);
}

function installMobileFit(mobileFitBreakpoint: number): void {
  const fitMedia = window.matchMedia(`(max-width: ${mobileFitBreakpoint}px)`);
  let fitLoaded = false;

  const loadFit = () => {
    if (!fitMedia.matches || fitLoaded) {
      return;
    }

    fitLoaded = true;
    void import("../fit/install").then(({ installTextmodeFit }) => {
      installTextmodeFit();
    });
  };

  loadFit();
  fitMedia.addEventListener("change", loadFit, { passive: true });
}

function readOptions(): BootstrapOptions {
  const dataset = document.body.dataset;

  return {
    mobileFitBreakpoint: readPositiveInteger(dataset.mobileFitBreakpoint, 760)
  };
}

function readPositiveInteger(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
