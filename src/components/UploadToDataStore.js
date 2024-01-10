/* global translator */
export class UploadToDataStore extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 data-i18n="upload-to-datastore.title"></h2>
        <p data-i18n="upload-to-datastore.content"></p>
        <div class="upload-btn-wrapper">
            <button class="btnr" data-i18n="upload-btn.choose">Choose file</button>
            <span data-i18n="upload-btn.no-file-chosen" id="jsonFileLabel">No file chosen</span>
            <input type="file" id="jsonFileInput" accept=".json" />
        </div>
        <button data-i18n="upload-btn.upload" onclick="uploadReferenceJson()" id="upload-btn" disabled="true"></button>`;

        let input = document.querySelector("#jsonFileInput");
        let uploadButton = document.querySelector("#upload-btn");

        input.addEventListener("input", () => {
            if (input.files.length > 0) {
                uploadButton.disabled = false;
            } else {
                uploadButton.disabled = true;
            }
        });

        input.addEventListener("change", () => {
            //Update the chosen file name. It might not exist
            let label = document.querySelector("#jsonFileLabel");
            let fileName = undefined;
            let input_files = input.files;

            if (input_files.length > 0) {
                let first_file = input_files[0];
                fileName = first_file.name;
            }

            //If undefined, use the default label
            if (!fileName) {
                label.innerHTML = translator.translateForKey("upload-btn.no-file-chosen");
            } else {
                label.innerHTML = fileName;
            }
        }
        );
    }
}