import { fetchIndicators, allowed_implementer_types, baseUrl } from "../js/utils";

export async function updateImplType() {
    let selImplementingPartner = document.getElementById("sel-implementing-partner");
    let implementingPartnerId = selImplementingPartner.options[selImplementingPartner.selectedIndex].value;
    let indicators = await fetchIndicators();
    await patchIndicatorAggregateDataExportCombo(indicators, implementingPartnerId).then((result) => {
        let progressDiv = document.getElementById("progressDiv");
        progressDiv.style.display = "none";
        let implTypeResult = document.getElementById("impl-type-result");
        implTypeResult.style.display = "block";
        if (result) {
            document.getElementById("impl-type-result").innerHTML = "Implementing partner attributes updated successfully";
        }
        else {
            document.getElementById("impl-type-result").innerHTML = "An error occurred while updating implementing partner attributes. Please try again.";
        }
    });
}

export async function patchIndicatorAggregateDataExportCombo(indicators, implementingPartnerId) {
    if (!indicators) {
        return false;
    }

    //Show and update progress bar
    let progressDiv = document.getElementById("progressDiv");
    progressDiv.style.display = "block";
    let progress = document.getElementById("progress");
    progress.value = 0;
    progress.max = indicators.length;
    let patch = [
        {
            "op": "add",
            "path": "/aggregateExportAttributeOptionCombo",
            "value": implementingPartnerId
        }
    ];

    try {
        for (let i = 0; i < indicators.length; i++) {

            await fetch(baseUrl + "indicators/" + indicators[i].id, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json-patch+json",
                    credentials: "include"
                },
                body: JSON.stringify(patch)
            });
            progress.value = i + 1;
        }
        return true;
    } catch (error) {
        console.error("Error fetching data:", error);
        return false;
    }
}

export class UpdateImplementerType extends HTMLElement {

    connectedCallback() {

        function populateImplementingPartners() {
            const implementingPartners = allowed_implementer_types;
            let selImplementingPartner = document.getElementById("sel-implementing-partner");
            implementingPartners.sort((a, b) => (a.name > b.name) ? 1 : -1);
            for (let i = 0; i < implementingPartners.length; i++) {
                let option = document.createElement("option");
                option.value = implementingPartners[i].id;
                option.text = implementingPartners[i].name;
                console.log(option);
                selImplementingPartner.appendChild(option);
            }
        }



        this.innerHTML = `<h2 data-i18n="update-impl-type.title"></h2>
        <p data-i18n="update-impl-type.content"></p>
        <select name="sel-implementing-partner" id="sel-implementing-partner"></select>
        <button id="btn-update-impl-type" onclick="updateImplType()" data-i18n="update-impl-type.update"></button>
        <div id = "progressDiv">
        <label for="progress">Updating indicators: </label>
            <progress id="progress" value="0" max="100"></progress>
        </div>
        <p id="impl-type-result"></p>
        `;
        //Hide the progress div intially
        const progressDiv = document.getElementById("progressDiv");
        progressDiv.style.display = "none";
        const result = document.getElementById("impl-type-result");
        result.style.display = "none";

        populateImplementingPartners();
    }
}