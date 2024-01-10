import { IntroPage } from "../components/IntroPage.js";
customElements.define("intro-page", IntroPage);

/* global translator */
export function showIntroduction() {
    document.querySelector("#appContent").innerHTML = "<intro-page></intro-page>";
    translator.translatePageTo();
}