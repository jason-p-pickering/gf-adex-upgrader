export class NavigationStrip extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <div style="display: flex; position: fixed; background: rgb(228, 228, 228); width: 100%; z-index: 10; top: 50px; flex: 1 1 0%; height: 40px;">
            <button class="tab active" onclick="showIntroduction()">Introduction</button>
            <button class="tab" onclick="showImportMetadataPackage()">Import</button>
            <button class="tab" onclick="showValidationReport()" >Validate</button>
            <button class="tab" onclick="showUpdateIndicatorsWorkflow()">Update</button>
            <button class="tab" onclick="showExportConfigWorkflow()">Export</button>
            <button class="tab" onclick="showUpdateImplType()">Implementer Type</button>
       </div>`;

        //Add a callback on each button to change the active class
        let tabs = document.getElementsByClassName("tab");
        for (let i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener("click", function () {
                let current = document.getElementsByClassName("active");
                current[0].className = current[0].className.replace(" active", "");
                this.className += " active";
            });
        }
    }
}

