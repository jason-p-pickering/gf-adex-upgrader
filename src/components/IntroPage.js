export class IntroPage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 class="introduction" data-i18n="introduction.title"></h2>
        <p class="introduction" data-i18n="introduction.content"></p>`;
    }
}