import { useNavigation } from "react-router";

/**
 * A slim taupe-to-green bar along the top of the window while the router loads the next page or submits a form
 * (styles: `.fz-progress` in globals.css). It waits 150 ms before showing, so quick navigations never flash it,
 * then eases towards the end without ever claiming to be finished. Under reduced motion it is a static bar.
 * Purely visual (aria-hidden): app pages also show their skeleton, and forms announce their own results.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  return <div aria-hidden className="fz-progress" data-active={navigation.state !== "idle" || undefined} />;
}
