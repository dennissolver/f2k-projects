/**
 * Property launch kit — in-repo shared primitives for property-sale
 * products (Seafields, Branscombe, future estates).
 *
 * Next step: lift this directory to cais-shared-services as
 * @caistech/property-launch-kit when a third product comes online and
 * the npm-package publishing overhead is worth it. The package surface
 * is the exports below.
 */

export {
  renderBrandedEmail,
  escapeHtml,
  formatCurrency,
  type Branding,
  type RenderArgs,
} from "./branded-email";

export { getActiveRecipients } from "./notify-recipients";
