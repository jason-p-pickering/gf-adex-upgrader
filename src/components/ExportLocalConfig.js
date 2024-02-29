import { fetchLocalDataExchanges } from "../js/utils.js";

export class ExportLocalConfig extends HTMLElement {
    connectedCallback() {

        async function populateExchangeDropdown() {
            const exchanges = await fetchLocalDataExchanges();
            if (!exchanges || exchanges.length === 0) {
                console.log("No GF data exchanges found");
                return;
            }
            console.log("Exchanges:", exchanges);
            const select = document.getElementById("data-exchanges");
            exchanges.forEach((exchange) => {
                const option = document.createElement("option");
                option.value = exchange.id;
                option.text = exchange.name;
                select.appendChild(option);
            });
        }

        populateExchangeDropdown();

        this.innerHTML = ` <h2 data-i18n="export-local-config.title"></h2>
        <p data-i18n="export-local-config.content"></p>
        <input type="checkbox" id="only-configured-indicators" checked>
        <label for="only-configured-indicators" data-i18n="export-local-config.configured-only">Configured only</label>
        <p/>
        <button onclick="exportLocalConfig()" id="btn-export-local-config" data-i18n="export-local-config.export-local-config"></button>
        <h2>Export Data exchanges</h2>
        <p data-i18n="export-local-config.export-options-content"></p>
        <label for="data-exchanges">Select an exchange: </label>
        <select id="data-exchanges"></select>
        <p/>
        <div id = "export-options">
        <label for="token" data-i18n="export-local-config.token"></label>
        <input type="password" id="token" placeholder="Token">
        <p/>
        <label for="destination-server" data-i18n="export-local-config.select-destination"></label>
        <select id="destination-server">
            <option value="https://adex.theglobalfund.org">ADEx Production</option>
            <option value="https://uat.adex.theglobalfund.org">ADEX UAT</option>
        </select>
        <p/>
        <button data-i18n="export-local-config.btn-export-exchange" onclick="exportLocalExchange()" id="btn-export-local-package"></button>`
        ;
    }
}