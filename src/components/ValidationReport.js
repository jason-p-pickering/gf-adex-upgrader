

import { d2Fetch, fetchIndicators, fetchIndicatorsFromDataStore, fetchPackageReleaseInfo, fetchRemoteAppVersion, fetchLocalAppVersion, allowed_implementer_types } from "../js/utils.js";

var indicators = false;
var operands = false;
var dataElements = false;
var updatedIndicators = false;
var systemInfo = false;
var dataSets = false;
var indicatorsConf = {};
var indicatorsUnconf = {};
var exchanges = false;
var root_orgunit = false;
var metadataPackage = false;
var releaseInfo = false;

const iso3_codes = ["AFG", "ALB", "AGO", "ARM", "AZE", "BGD", "BLR", "BLZ",
    "BEN", "BTN", "BOL", "BWA", "BFA", "BDI", "CPV", "KHM", "CMR", "CAF", "TCD",
    "COL", "COM", "COG", "COD", "CRI", "CIV", "CUB", "DJI", "DOM", "ECU", "EGY",
    "SLV", "ERI", "SWZ", "ETH", "FJI", "GAB", "GMB", "GEO", "GHA", "GTM", "GIN",
    "GNB", "GUY", "HTI", "HND", "IND", "IDN", "IRN", "JAM", "KAZ", "KEN", "PRK",
    "XXK", "KGZ", "LAO", "LSO", "LBR", "MDG", "MWI", "MYS", "MLI", "MRT", "MUS",
    "MDA", "MNG", "MNE", "MAR", "MOZ", "MMR", "NAM", "NPL", "NIC", "NER", "NGA",
    "PAK", "PNG", "PRY", "PER", "PHL", "RUS", "RWA", "STP", "SEN", "SRB", "SLE",
    "SLB", "SOM", "ZAF", "SSD", "LKA", "SDN", "SUR", "TJK", "TZA", "THA", "TLS",
    "TGO", "TUN", "TKM", "UGA", "UKR", "UZB", "VUT", "VEN", "VNM", "YEM", "ZMB",
    "XZB", "ZWE"];

/* const deprecated_disaggs = ["[GFADEX]_zahS139rbsw_JvMC3Upxlfm",
    "[GFADEX]_zahS139rbsw_dqWGfhcYKVc",
    "[GFADEX]_zahS139rbsw_HHWpfU2sdY8",
    "[GFADEX]_zahS139rbsw_ALKz740sO3g",
    "[GFADEX]_kJqLw03R9Ed_Mv7alogTdRO",
    "[GFADEX]_kJqLw03R9Ed_R6wmErAXOfn",
    "[GFADEX]_kJqLw03R9Ed_mi6A1yAt9dW",
    "[GFADEX]_kJqLw03R9Ed_FVeC7C3hOds",
    "[GFADEX]_kJqLw03R9Ed_jWiIX91bKM8",
    "[GFADEX]_kJqLw03R9Ed_LbSrMlI9jVp",
    "[GFADEX]_dy3MD8X9erl_tW9iYwweSjv"
]; */

var indicatorpTypes = {
    "MONTHLY": [],
    "QUARTERLY": [],
    "YEARLY": []
};


class ValidationResult {
    constructor(title, instruction, headers) {
        this.title = title;
        this.instruction = instruction;
        this.headers = headers;
        this.issues = [];
    }
}

class RequestsDuplicatedIndicators extends ValidationResult {
    constructor() {
        super("Requests with duplicate indicators",
            "GF ADEx requests with the same indicator repeated in the `dx` section. Resolve the duplicates listed below.",
            [{ "title": "Request" }, { "title": "Duplicates" }]);
    }
}

class RequestsInidicatorsNotConfigured extends ValidationResult {
    constructor() {
        super("Requests with indicators that are not configured",
            "GF ADEx requests that include indicators that are not configured, meaning their numerator is 0. These indicators should either configured, or removed from the request.",
            [{ "title": "Request" }, { "title": "Indicator name" }, { "title": "Indicator id" }, { "numerator": "Numerator" }]);
    }
}

var validationResults = {
    "REQ_IND_DUPLICATED": new RequestsDuplicatedIndicators(),
    "REQ_IND_UNCONF": new RequestsInidicatorsNotConfigured(),
    "REQ_IND_NONGF": {
        "title": "Requests with non-GFADEx indicators",
        "instruction": "GFADEx requests with indicators that are not GFADEx indicators. Only GFADEx indicators should be included in GFADEx requests. Remove the unknown indicators from the GFADEx requests.",
        "headers": [{ "title": "Request" }, { "title": "Indicator ID" }],
        "issues": []
    },
    "REQ_PE_MIXED": {
        "title": "Requests with mixed period types",
        "instruction": "GF ADEx requests should not contain periods of different period types. Revise the requests to include only one period type.",
        "headers": [{ "title": "Request" }, { "title": "Request period" }],
        "issues": []
    },
    "REQ_PE_UNKNOWN": {
        "title": "Requests with unsupported period types",
        "instruction": "GF ADEx requests should only consist of monthly, quarterly, or yearly periods. Revise the requests to include only one of these types.",
        "headers": [{ "title": "Request" }, { "title": "Request period" }],
        "issues": []
    },
    "REQ_IND_PERIOD_CONFLICT": {
        "title": "Indicators in multiple requests with different period types",
        "instruction": "GF ADEx indicators can be may be used in multiple requests, but they should never be used in requests with periods which overlap. Carefully review the requests listed below to ensure that the periods do not overlap with one another.",
        "headers": [{ "title": "Indicator name" }, { "title": "Indicator id" }, { "title": "Request" }],
        "issues": []
    },
    "REQ_PE_RELATIVE": {
        "title": "Requests with non-relative period types",
        "instruction": "GF ADEx requests should usually only contain relative periods. Review the affected requests and consider changing the periods to relative periods.",
        "headers": [{ "title": "Request" }, { "title": "Request period" }],
        "issues": []
    },
    "IND_CONF_IGNORED": {
        "title": "Indicators that are configured but not in requests",
        "instruction": "Usually, GF ADEx indicators that have been configured (numerator != 0), should be part of a request. Carefully review all of the listed indicators to ensure that they are not needed in any of the requests. Consider to delete these indicators if they are not needed.",
        "headers": [{ "title": "Indicator name" }, { "title": "Indicator id" }],
        "issues": []
    },
    "IND_DENOM_CHANGED": {
        "title": "GF ADEx indicators with modified denominator",
        "instruction": "All GF ADEx indicators should have a denominator of '1'. Revise the indicators listed below to ensure that the denominator is set to '1'.",
        "headers": [{ "title": "Indicator name" }, { "title": "Indicator id" }, { "title": "Denominator" }],
        "issues": []
    },
    "IND_DECIMALS_CHANGED": {
        "title": "GF ADEx indicators with modified decimals",
        "instruction": " All GF ADEx indicators should have the number of decimals set to '0'. For each indicator listed, change the \"Decimals in data output\" property of the indicator to '0' using the Maintenance app.",
        "headers": [{ "title": "Indicator name" }, { "title": "Indicator id" }, { "title": "Decimals" }],
        "issues": []
    },
    "IND_IMPLEMENTER_TYPE": {
        "title": "GF ADex Indicators with incorrect implementer type",
        "instruction": "GF ADEx indicators should be associated with a valid implementer type. For each indicator listed, change the \"Attribute option combination for data export\" to a valid implementer type UID. Consult the documentation for a list of possible values.",
        "headers": [{ "title": "Indicator name" }, { "title": "Indicator id" }, { "title": "Implementer type" }],
        "issues": []
    },
    "EX_PUBLIC_SHARING": {
        "title": "GF ADEX exchanges should not be publicly shared",
        "instruction": "GF ADEx exchanges should only be shared with specific users or user groups. Remove the public sharing from the exchanges listed below and share them with specific users instead.",
        "headers": [{ "title": "Exchange name" }],
        "issues": []
    },
    "EX_USERGROUP_SHARING": {
        "title": "GF ADEx exchanges should be shared with user groups",
        "instruction": "GF ADEx exchanges should be shared with user groups who either need access to view them or who have access to actually submit a data exchange. Add user groups with appropriate permissions to the exchanges listed below.",
        "headers": [{ "title": "Exchange name" }],
        "issues": []
    },
    "REQ_OUTPUT_ID_SCHEME": {
        "title": "GF ADEx requests should use the correct attribute output scheme",
        "instruction": "GF ADEx requests should use the correct attribute output scheme specifically (\"outputIdScheme\": \"attribute:nHzX73VyNun\"). Revise the requests listed below to ensure that the output ID scheme is set correctly.",
        "headers": [{ "title": "Request" }, { "title": "Output ID scheme" }],
        "issues": []
    },
    "EX_TARGET_API": {
        "title": "GF ADEx exchanges should use the correct target server.",
        "instruction": "GF ADEx exchanges should use the correct target server: https://adex.theglobalfund.org. Note, during testing you should use the UAT server at https://uat.adex.theglobalfund.org. However, once you move your exchange to production, be sure that the target API is set to the correct server.",
        "headers": [{ "title": "Exchange name" }, { "title": "Target API" }],
        "issues": []
    },
    "EX_BASIC_AUTH": {
        "title": "GF ADEx exchanges should not use basic authentication.",
        "instruction": "GF ADEx exchanges should used a personal access token instead of basic authentication. Remove any basic authentication credentials from the exchanges listed below and replace them with a DHIS2 personal access token.",
        "headers": [{ "title": "Exchange name" }, { "title": "Username" }],
        "issues": []
    },
    "REQ_ROOT_ORGUNIT": {
        "title": "GF ADEx requests should be aggregated to the level 1 organisation unit.",
        "instruction": "Currently, GF ADEx requests should be aggregated to the level 1 organisation unit. Revise the requests listed below to ensure that the organisation unit is set to the level 1 organisation unit (National level).",
        "headers": [{ "title": "Request" }, { "title": "Organisation unit" }],
        "issues": []
    },
    "ORGUNIT_CODE": {
        "title": "The root organisation unit should have a valid ISO3 code as the code or as an attribute",
        "instruction": "Check to be sure that you have defined either the code or attribute for your country with the correct ISO3 code. Consult the GF ADEx documentation for a list of valid ISO3 codes.",
        "headers": [{ "title": "Organisation unit" }, { "title": "Code" }, { "title": "Attribute" }],
        issues: []
    },
    "EX_TARGET_OU_SCHEME": {
        "title": "GF ADEx exchanges should use the correct target organisation unit scheme.",
        "instruction": "GF ADEX exchanges should use \"CODE\" as the target organisation unit scheme. Revise the exchanges listed below and change the target organisation unit scheme to \"CODE\".",
        "headers": [{ "title": "Exchange name" }, { "title": "Target OU scheme" }],
        issues: []
    },
    "EX_TARGET_ID_SCHEME": {
        "title": "GF ADEx exchanges should use the correct target ID scheme.",
        "instruction": "GF ADEX exchanges should use \"UID\" as the target ID scheme. Revise the exchanges listed below and change the target ID scheme to \"UID\".",
        "headers": [{ "title": "Exchange name" }, { "title": "Target ID scheme" }],
        issues: []
    },
    "EX_EXIST": {
        "title": "At least one GF ADEx data exchange should exist",
        "instruction": "At least one aggregate data exchange with a target API URL containing \"globalfund\" should exist.",
        "headers": [{ "title": "Exchange name" }],
        issues: []
    },
    "INDS_EXIST": {
        "title": "At least one GF indicator should exist.",
        "instruction": "If you have not already imported the GF ADEX metadata package, you should do so now.",
        "headers": [{ "title": "Indicator name" }],
        issues: []
    },
    "REFERENCE_METADATA": {
        "title": "The GFADEX reference metadata package should be imported to the datastore.",
        "instruction": "If you have not already imported a GFADEX metadata package, you should do so now using the GF ADEx Flow app.",
        "headers": [{ "title": "Message" }],
        issues: []
    },
    "IND_UNKNOWN_IN_REQUESTS": {
        "title": "GFADEX requests should not include indicators that are not in the GFADEX metadata package.",
        "instruction": "Unknown GF ADEX indicator should not be used in any requests made to the GF ADEx server. Remove the unknown indicators from the GF ADEx requests.",
        "headers": [{ "title": "ID" }, { "title": "Indicator name" }],
        issues: []
    },
    "IND_MUTUALLY_EXCLUSIVE_AGE_BANDS": {
        "title": "Indicators which have defined mutually exclusive age bands.",
        "instruction": "Certain GF ADex indicators have a category combination with non-mutually exclusive age bands. You should not submit age bands which overlap with one another. For instance, if you submit <5, 5-14, you should not also submit <15 for the same GF ADEx indicator.  You should use either the fine age bands or the coarse age bands, but not both. Please remove the coarse age band if you can map the fine age bands. Review the indicators listed below and ensure that the age bands are mutually exclusive for the same indicator.",
        "headers": [{ "title": "Indicator name" }],
        issues: []
    },
    "METADATA_PACKAGE_VERSION": {
        "title": "The GFADEX metadata package should be the latest version.",
        "instruction": "A new version of the GFADEX metadata package is available. You should import the latest version of the GFADEX metadata package to the datastore. Follow the instructions provided in the GF ADEx Flow app \"Update\" section.",
        "headers": [{ "title": "Remote version" }, { "title": "Local version" }],
        issues: []
    },
    "APP_VERSION": {
        "title": "The GFADEX app should be the latest version.",
        "instruction": "A new version of the GFADEX app is available. You should update the GFADEX app to the latest version. The ADEx Flow app is availble in the DHIS2 App Hub. Open the App Management app and search for \"ADEx Flow\" to install the latest version.",
        "headers": [{ "title": "Remote version" }, { "title": "Local version" }],
        issues: []
    },
    "SINGLE_IMPLEMENTER_TYPE": {
        "title": "All GFADEX indicators which are configured should be attributed to a single implementer type.",
        "instruction": "Review the indicators listed below and ensure that they are all attributed to a single implementer type.",
        "headers": [  { "title": "Implementer type" }, {"title": "Count of indicators" }],
        issues: []
    }
};


async function fetchExchanges() {
    const data = await d2Fetch("aggregateDataExchanges.json?filter=target.api.url:like:globalfund&fields=*&paging=false");
    if (!data || data.aggregateDataExchanges.length === 0) {
        console.log("No GF data exchanges found");
        return false;
    }
    else {
        return data.aggregateDataExchanges;
    }
}

//Get the national orgunit
async function fetchRootOrgUnit() {
    const data = await d2Fetch("organisationUnits.json?filter=level:eq:1&fields=id,name,code,attributeValues[*]");
    if (!data || data.organisationUnits.length === 0) {
        console.log("No root orgunit found");
        return false;
    }
    else {
        return data.organisationUnits[0];
    }
}

//Get the data element operands to substitute in the indicator formulas
async function fetchDataElementOperands() {
    const data = await d2Fetch("dataElementOperands.json?fields=id,shortName,dimensionItem&paging=false");
    if (!data || data.dataElementOperands.length === 0) {
        console.log("No data element operands could be found.");
        return false;
    }
    else {
        return data;
    }
}

//Get the data elements when used directly in formulas
async function fetchDataElements() {
    const data = await d2Fetch("dataElements.json?fields=id,shortName&paging=false");
    if (!data || data.dataElements.length === 0) {
        console.log("No data elements could be found.");
        return false;
    }
    else {
        return data;
    }
}

async function fetchSystemInfo() {
    const data = await d2Fetch("system/info.json");
    if (!data || data.length === 0) {
        console.log("Could not fetch system info.");
        return false;
    }
    else {
        return data;
    }

}

async function fetchDataSets() {
    const data = await d2Fetch("dataSets.json?fields=id,name&paging=false");
    if (!data || data.dataSets.length === 0) {
        console.log("No data sets could be found.");
        return false;
    }
    else {
        return data;
    }
}

//Separate configured and non-configured indicators
function indicatorsCategorize(indicators) {
    var indicatorsConf = {};
    var indicatorsUnconf = {};

    indicators.forEach(indicator => {
        indicator.numerator.trim() == "0" ?
            indicatorsUnconf[indicator.id] = indicator :
            indicatorsConf[indicator.id] = indicator;
    });

    return { "indicatorsConf": indicatorsConf, "indicatorsUnconf": indicatorsUnconf };
}

//Get unique values from array of strings
function uniqueEntries(array) {
    return array.filter(function (el, index) {
        return index === array.indexOf(el);
    });
}

//Find any duplicate UIDs within a single request
function findDuplicatesInRequests(exchanges, validationResults) {
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            if (req.dx.length != uniqueEntries(req.dx).length) {
                const dxs_duplicated = req.dx.filter((e, i, arr) => arr.indexOf(e) !== i);
                validationResults["REQ_IND_DUPLICATED"].issues.push([req.name, dxs_duplicated.join(", ")]);
            }
        }
    }
}

//Find unconfigured indicators in requests
function findUnconfiguredInRequests(exchanges, indicatorsUnconf, validationResults) {
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            for (var ind of req.dx) {
                if (indicatorsUnconf[ind]) {
                    let numerator_preview = indicatorsUnconf[ind].numerator;
                    //Just show a few characters here if not zero to allow further investigation
                    if (numerator_preview != "0") {
                        numerator_preview = numerator_preview.substring(0, 50) + "...";
                    }
                    validationResults["REQ_IND_UNCONF"].issues.push([req.name, indicatorsUnconf[ind].name, ind, numerator_preview]);
                }
            }
        }
    }
}

//Find configured indicators NOT in requests
function findConfiguredNotInRequests(exchanges, indicatorsConf, validationResults) {
    for (var confInd in indicatorsConf) {
        var found = false;
        for (var ex of exchanges) {
            for (var req of ex.source.requests) {
                if (req.dx.indexOf(confInd) !== -1) {
                    found = true;
                    break;
                }
            }

            if (found) {
                break;
            }
        }

        if (!found) {
            validationResults["IND_CONF_IGNORED"].issues.push([indicatorsConf[confInd].name, indicatorsConf[confInd].id]);
        }
    }
}

function findChangedDenominators(indicators, validationResults) {
    for (var ind of indicators) {
        if (ind.denominator.trim() != "1") {
            validationResults["IND_DENOM_CHANGED"].issues.push([ind.name, ind.id, ind.denominator]);
        }
    }
}

//Find non-GF indicators in request
function findNonAdexIndicatorsInRequests(exchanges, indicatorsUnconf, indicatorsConf, validationResults) {
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            for (var ind of req.dx) {
                if (!Object.prototype.hasOwnProperty.call(indicatorsUnconf, ind) &&
                    !Object.prototype.hasOwnProperty.call(indicatorsConf, ind)) {
                    validationResults["REQ_IND_NONGF"].issues.push([req.name, ind]);
                }
            }
        }
    }
}

//Find indicators with decimals != 0
function findChangedDecimals(indicators, validationResults) {
    for (var ind of indicators) {
        if (ind.decimals != 0) {
            validationResults["IND_DECIMALS_CHANGED"].issues.push([ind.name, ind.id, ind.decimals]);
        }
    }
}

function findInvalidImplementerTypes(indicators, validationResults) {
    for (var ind of indicators) {
        if (!allowed_implementer_types.some(allowed_type => allowed_type.id === ind.aggregateExportAttributeOptionCombo)) {
            validationResults["IND_IMPLEMENTER_TYPE"].issues.push([ind.name, ind.id, ind.aggregateExportAttributeOptionCombo]);
        }
    }
}

function findPublicAccess(exchanges, validationResults) {
    for (var ex of exchanges) {
        if (ex.sharing.public != "--------") {
            validationResults["EX_PUBLIC_SHARING"].issues.push([ex.name]);
        }
    }
}


//Add results to report
/* global DataTable, $ */
function printValidationResults(validationResults) {

    //Make summary
    var html = "<div id='summary_table'><h2>Summary</h2>";
    html = html + "<table id='summary' class='display' width='100%'>";
    html = html + "<thead><tr><th>Validation check</th><th>Result</th></tr></thead><tbody>";
    for (var validationType in validationResults) {
        var result = validationResults[validationType];
        html = html + "<tr><td>" + result.title + "</td>";
        if (result.issues.length === 1) {
            html = html + "<td>" + result.issues.length + " issue</td></tr>";
        } else if (result.issues.length > 1) {
            html = html + "<td>" + result.issues.length + " issues</td></tr>";
        }
        else {
            html = html + "<td>OK</td></tr>";
        }
    }

    html = html + "</tbody></table></div>";
    $("#validation-result").append(html);
    new DataTable("#summary", { "paging": false, "searching": false, order: [[1, "asc"]] });


    //Make detailed tables, only if there are violations
    for (validationType in validationResults) {
        result = validationResults[validationType];
        if (result.issues.length > 0) {
            html = "<h2>" + result.title + "</h2>";
            html = html + "<p>" + result.instruction + "</p>";
            html = html + "<table id='" + validationType + "' class='display' width='100%'></table>";
            $("#validation-result").append(html);

            new DataTable("#" + validationType, {
                columns: result.headers,
                data: result.issues
            });
        }
    }

    //Make the #validation result div scrollable
    $("#validation-result").css("overflow", "visible");
    $("#validation-result").css("overflow-y", "auto");
    $("#validation-result").css("height", "90%");

}

const relativeQuarters = ["THIS_QUARTER", "LAST_QUARTER", "QUARTERS_THIS_YEAR", "QUARTERS_LAST_YEAR", "LAST_4_QUARTERS"];
const relativeMonths = ["THIS_MONTH", "LAST_MONTH", "MONTHS_THIS_YEAR", "MONTHS_LAST_YEAR", "LAST_12_MONTHS"];
const relativeYears = ["LAST_YEAR", "THIS_YEAR"];

const relativePeriodTypes = {
    "MONTHLY": relativeMonths,
    "QUARTERLY": relativeQuarters,
    "YEARLY": relativeYears
};

const fixedMonths = /^20[2-3][0-9][0-1][0-9]$/;
const fixedQuarters = /^202[0-9]Q[1-4]/;
const fixedYears = /^202[0-9]$/;

const fixedPeriodTypes = {
    "MONTHLY": fixedMonths,
    "QUARTERLY": fixedQuarters,
    "YEARLY": fixedYears
};

function classifyPeriod(period) {


    for (const [type, values] of Object.entries(relativePeriodTypes)) {
        if (values.includes(period)) {
            return { "RELATIVE": type };
        }
    }

    for (const [type_fixed, regex] of Object.entries(fixedPeriodTypes)) {
        if (regex.test(period)) {
            return { "FIXED": type_fixed };
        }
    }
    return { "UNKNOWN": "UNKNOWN" }; // If no match is found
}

function getIndicatorAttributeFromID(id, attribute, indicators) {
    for (var ind of indicators) {
        if (ind.id === id) return ind[attribute];
    }
    return "UNKNOWN";
}

function classifyPeriods(periods) {
    const periodTypes = periods.map(period => classifyPeriod(period));
    const uniquePeriodTypes = [...new Set(periodTypes.map(periodType => Object.values(periodType)[0]))];
    //Unknown takes precedence
    if (uniquePeriodTypes.some(periodType => periodType === "UNKNOWN")) {
        return "UNKNOWN";
    }
    //Otherwise, if there are multiple types, it's mixed
    if (uniquePeriodTypes.length > 1) {
        return "MIXED";
    }
    //Otherwise, it's the only type
    return uniquePeriodTypes[0];
}

function requestsWithIndicator(indicatorId, exchanges) {
    var requests = [];
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            if ($.inArray(indicatorId, req.dx) >= 0) requests.push(req.name);
        }
    }
    return requests;

}

//Separate request dx by periodicity
function findRequestPeriodInoncistenies(exchanges, indicators, indicatorpTypes, validationResults) {
    /* Loop over all requests and
    1) look for period issues within requests
    2) categories indicators by periodtype */

    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            const periodType = classifyPeriods(req.pe);
            if (periodType === "UNKNOWN") {
                validationResults["REQ_PE_UNKNOWN"].issues.push([req.name, req.pe.join(",")]);
            }
            else if (periodType === "MIXED") {
                validationResults["REQ_PE_MIXED"].issues.push([req.name, req.pe.join(",")]);
            }
            else {
                indicatorpTypes[periodType] = indicatorpTypes[periodType].concat(req.dx);
            }
        }
    }

    //When we have indicators categorized by periodType, we can look for IDs appearing in multiple
    var allPtypes = ["MONTHLY", "QUARTERLY", "YEARLY"];
    for (var i = 0; i < (allPtypes.length - 1); i++) {
        for (var ind of indicatorpTypes[allPtypes[i]]) {
            for (var j = i + 1; j < allPtypes.length; j++) {
                for (var otherInd of indicatorpTypes[allPtypes[j]]) {
                    if (ind === otherInd) {
                        validationResults["REQ_IND_PERIOD_CONFLICT"].issues.push([getIndicatorAttributeFromID(ind, "name", indicators), ind, requestsWithIndicator(ind, exchanges).join(", ")]);
                    }
                }
            }

        }
    }
}

function findNonRelativePeriods(exchanges, validationResults) {
    const relative_period_types = relativeQuarters.concat(relativeMonths, relativeYears);
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            if (req.pe.some(pe => !relative_period_types.includes(pe))) {
                validationResults["REQ_PE_RELATIVE"].issues.push([req.name, req.pe.join(",")]);
            }

        }
    }
}


function findUserGroupAccess(exchanges, validationResults) {
    for (var ex of exchanges) {
        if (ex.userGroupAccesses?.length == undefined || ex.userGroupAccesses?.length == 0) {
            validationResults["EX_USERGROUP_SHARING"].issues.push([ex.name]);
        }
    }
}


function findWrongOutputIDScheme(exchanges, validationResults) {
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            //Convert attribute to ATTRIBUTE
            const outputIdScheme = req.outputIdScheme.replace("attribute:", "ATTRIBUTE:");
            if (outputIdScheme != "ATTRIBUTE:nHzX73VyNun") {
                validationResults["REQ_OUTPUT_ID_SCHEME"].issues.push([req.name, req.outputIdScheme]);
            }
        }
    }
}

function findTargetAPI(exchanges, validationResults) {
    for (var ex of exchanges) {
        if (ex.target.api.url != "https://adex.theglobalfund.org/") {
            validationResults["EX_TARGET_API"].issues.push([ex.name, ex.target.api.url]);
        }
    }
}

function findBasicAuth(exchanges, validationResults) {
    for (var ex of exchanges) {
        if (Object.prototype.hasOwnProperty.call(ex.target.api, "username")) {
            validationResults["EX_BASIC_AUTH"].issues.push([ex.name, ex.target.api.username]);
        }
    }
}

function validateRootOrgUnit(root_orgunit, exchanges, validationResults) {
    const root_orgunit_uid = root_orgunit.id;
    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            if (req.ou != root_orgunit_uid || req.ou.length != 1) {
                validationResults["REQ_ROOT_ORGUNIT"].issues.push([req.name, req.ou]);
            }
        }

    }
}

function validateOrgUnitCode(root_orgunit, validationResults) {

    const attributeValue = root_orgunit.attributeValues.find(
        (attributeValue) => attributeValue.attribute.id === "hpe7LiGDgvo"
    );
    //These could be undefined
    var ou_is_configured = iso3_codes.includes(root_orgunit?.code) || iso3_codes.includes(attributeValue?.value);
    //If neither is defined, ou_is_configured is false
    if (typeof ou_is_configured === "undefined") {
        ou_is_configured = false;
    }

    var orgunitCode = "";
    var attributeValueCode = "";

    if (typeof root_orgunit?.code === "undefined" ){
        orgunitCode = "UNKNOWN";
    } else {
        orgunitCode = root_orgunit.code;
    }

    if (typeof attributeValue?.value === "undefined" ){
        attributeValueCode = "UNKNOWN";
    } else {
        attributeValueCode = attributeValue.value;
    }

    if (!ou_is_configured) {
        validationResults["ORGUNIT_CODE"].issues.push([root_orgunit.name, orgunitCode, attributeValueCode]);
    }
}

function validateExchangeTargetOuScheme(exchanges, validationResults) {

    for (var ex of exchanges) {
        const targetOuScheme = ex.target.request.orgUnitIdScheme ?? "UNKNOWN";
        if (targetOuScheme != "CODE") {
            validationResults["EX_TARGET_OU_SCHEME"].issues.push([ex.name, targetOuScheme]);
        }
    }
}

function validateReferenceMetadata(metadataPackage) {
    const requiredKeys = ["package", "attributes", "indicators", "userGroups", "indicatorTypes", "indicatorGroups"];
    const missingKeys = requiredKeys.filter(key => !Object.keys(metadataPackage).includes(key));

    if (missingKeys.length > 0) {
        validationResults["REFERENCE_METADATA"].issues.push(["The metadata package is missing the following keys: " + missingKeys.join(", ")]);
    }

    if (metadataPackage?.package != undefined) {
        const pacakgeMetadata = metadataPackage?.package[0];
        //Check that the version is follows a semver pattern
        const packageVersion = pacakgeMetadata?.version;
        const semverPattern = /^\d+\.\d+\.\d+$/;
        if (!semverPattern.test(packageVersion)) {
            validationResults["REFERENCE_METADATA"].issues.push(["The GFADEX metadata package versions is not valid: " + packageVersion]);
        }

        //Check that the package origin is globalfund.org
        const packageOriginPattern = /globalfund\.org$/;
        const packageOrigin = pacakgeMetadata?.origin;
        if (!packageOriginPattern.test(packageOrigin)) {
            validationResults["REFERENCE_METADATA"].issues.push(["The GFADEX metadata package origin is not valid: " + packageOrigin]);
        }
    }


}


function checkTargetOutputIdScheme(exchanges, validationResults) {

    for (var ex of exchanges) {
        if (ex.target.request.idScheme != "UID") {
            validationResults["EX_TARGET_ID_SCHEME"].issues.push([ex.name, ex.target.request.idScheme]);
        }
    }
}

function addFooters(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    for (var i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text("Page " + String(i) + " of " + String(pageCount), doc.internal.pageSize.width / 2, 287, {
            align: "center"
        });
    }
}

function identifyUnknownIndicatorsInRequests(exchanges, indicators, metadataPackage) {
    const knownIndicators = metadataPackage.indicators.map(indicator => indicator.id);
    const unknownIndicators = [];

    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            for (var ind of req.dx) {
                if (!knownIndicators.includes(ind)) {
                    unknownIndicators.push(ind);
                }
            }
        }
    }
    //Filter local GFADEx indicators which have been used in requests but which are not part of the GFADEX metadata package
    const unknownIndicatorsInReqests = indicators.filter(indicator => unknownIndicators.includes(indicator.id));

    if (unknownIndicatorsInReqests.length > 0) {
        validationResults["IND_UNKNOWN_IN_REQUESTS"].issues = unknownIndicatorsInReqests.map(indicator => [indicator.id, indicator.name]);
    }
}


function getUniqueImplementerTypes(indicatorsConf) {
    const implementerTypes = indicatorsConf.map(indicator => indicator.aggregateExportAttributeOptionCombo);
    const uniqueImplementerTypes = [...new Set(implementerTypes)];
    //Remape these to readable values with the help of the allowed_implementer_types
    return uniqueImplementerTypes.map(implType => allowed_implementer_types.find(impl => impl.id === implType).name);
}

function identifyMutuallyExclusiveAgeBands(indicatorsConf, exchanges) {

    if (indicatorsConf.length === 0) {
        return;
    }

    if (exchanges.length === 0) {
        return;
    }
    console.log("Configured indicators",  indicatorsConf);
    //Filter  configured indicators which exist in the exchanges
    var exchangeIndicators = [];
    exchanges.forEach(exchange => {
        exchangeIndicators = exchangeIndicators.concat(exchange.source.requests.flatMap(request => request.dx));});
    var indicatorsInExchanges = [];
    for (var indicator in indicatorsConf) {
        if (exchangeIndicators.includes(indicator)) {
            indicatorsInExchanges.push(indicatorsConf[indicator]);
        }
    }
    console.log("Indicators in exchanges", indicatorsInExchanges);
    if (indicatorsInExchanges.length === 0  || indicatorsInExchanges == undefined) {
        return;
    }

    //const indicatorsInExchanges = indicatorsConf;
    const mutuallyExclusiveAgeBands = [
        {
            "dataElement": "kJqLw03R9Ed",
            "leftSideOptions": ["RPseIh0fIIb", "zbsxVMPLP1M", "X7SDej47sb9", "sF8NGOqMeDj", "SGjUYxKpJa1", "oJ1VU54aHQb"],
            "rightSideOptions": ["SSYyE93vzp1", "kLmUIk88rZn", "qzta2Ue73Mx"]
        },
        {
            "dataElement": "zahS139rbsw",
            "leftSideOptions": ["RPseIh0fIIb", "zbsxVMPLP1M", "X7SDej47sb9", "sF8NGOqMeDj", "SGjUYxKpJa1", "oJ1VU54aHQb"],
            "rightSideOptions": ["SSYyE93vzp1", "kLmUIk88rZn", "qzta2Ue73Mx"]
        }
    ];

    mutuallyExclusiveAgeBands.forEach(rule => {
        //First, filter all indicators which data elements matches
        const dataElementMatches = indicatorsInExchanges.filter(indicator => indicator.code.includes(rule.dataElement));
        //Are there any matches?
        if (dataElementMatches == undefined || dataElementMatches.length === 0) {
            return;
        }

        const leftSideMatches = dataElementMatches.filter(indicator => rule.leftSideOptions.some(option => indicator.code.includes(option)));
        const rightSideMatches = dataElementMatches.filter(indicator => rule.rightSideOptions.some(option => indicator.code.includes(option)));

        if (leftSideMatches.length > 0 && rightSideMatches.length > 0) {
            leftSideMatches.forEach(indicator => {
                validationResults["IND_MUTUALLY_EXCLUSIVE_AGE_BANDS"].issues.push([indicator.name]);
            }
            );
            rightSideMatches.forEach(indicator => {
                validationResults["IND_MUTUALLY_EXCLUSIVE_AGE_BANDS"].issues.push([indicator.name]);
            }
            );

            validationResults["IND_MUTUALLY_EXCLUSIVE_AGE_BANDS"].issues = validationResults["IND_MUTUALLY_EXCLUSIVE_AGE_BANDS"].issues.filter((issue, index, self) =>
                index === self.findIndex((t) => (
                    t[0] === issue[0]
                ))
            );
        }
    });



}

/*global semver */
function checkMetadataPackageVersion(releaseInfo, localPackage) {

    const localVersion = localPackage.package[0].version;
    if (!semver.valid(localVersion)) {
        console.log("Local version is not valid semver: ", localVersion);
        return false;
    }

    const remoteVersion = releaseInfo.tag_name;

    if (!semver.valid(remoteVersion)) {
        console.log("Remote version is not valid semver: ", remoteVersion);
        return false;
    }

    if (!semver.eq(remoteVersion, localVersion)) {
        validationResults["METADATA_PACKAGE_VERSION"].issues.push([remoteVersion, localVersion]);
    }
}

function checkAppVersion(remoteAppVersion, localAppVersion) {
    if (!semver.valid(localAppVersion)) {
        console.log("Local version is not valid semver: ", localAppVersion);
        localAppVersion = "0.0.0";
    }

    if (!semver.valid(remoteAppVersion)) {
        console.log("Remote version is not valid semver: ", remoteAppVersion);
        return false;
    }
    if (!semver.eq(remoteAppVersion, localAppVersion)) {
        validationResults["APP_VERSION"].issues.push([remoteAppVersion, localAppVersion]);
    }


}

function checkSingleImplementerType(indicatorsConf) {
    const indicatorImplementerTypeMap = {};

    for (const key in indicatorsConf) {
        if (Object.prototype.hasOwnProperty.call(indicatorsConf, key)) {
            const indicator = indicatorsConf[key];
            indicatorImplementerTypeMap[key] = indicator.aggregateExportAttributeOptionCombo;
            const implementerType = allowed_implementer_types.find(impl => impl.id === indicator.aggregateExportAttributeOptionCombo).name;
            indicatorImplementerTypeMap[key] = { "name": indicator.name, "implementerType": implementerType };
        }
    }

    //Count the implementer types
    const implementerTypeCounts = {};
    for (const key in indicatorImplementerTypeMap) {
        if (Object.prototype.hasOwnProperty.call(indicatorImplementerTypeMap, key)) {
            const indicator = indicatorImplementerTypeMap[key];
            if (Object.prototype.hasOwnProperty.call(implementerTypeCounts, indicator.implementerType)) {
                implementerTypeCounts[indicator.implementerType] += 1;
            } else {
                implementerTypeCounts[indicator.implementerType] = 1;
            }
        }
    }
    if (Object.keys(implementerTypeCounts).length > 1) {
        for (const key in implementerTypeCounts) {
            if (Object.prototype.hasOwnProperty.call(implementerTypeCounts, key)) {
                validationResults["SINGLE_IMPLEMENTER_TYPE"].issues.push([key, implementerTypeCounts[key]]);
            }
        }
    }

}

export async function reportToPDF() {

    const { jsPDF } = window.jspdf;
    var doc = new jsPDF("portrait");
    const current_time = new Date().toJSON();
    //Need to resolve the promise first since it's async
    const localAppVersion = await fetchLocalAppVersion();
    console.log("Local app version", localAppVersion);
    doc.text("ADEX Validation Report", 20, 20);
    doc.text("Hostname: " + systemInfo.contextPath, 20, 30);
    doc.text("DHIS2 Version: " + systemInfo.version, 20, 40);
    doc.text("Revision:" + systemInfo.revision, 20, 50);
    const metadataPackageVersion = metadataPackageIsPresent(metadataPackage) ? metadataPackage.package[0].version : "UNKNOWN";
    doc.text("Package version: " + metadataPackageVersion, 20, 60);
    doc.text("App version: " + localAppVersion, 20, 70);
    doc.text("Generated on: " + current_time, 20, 80);
    doc.text("Country: " + root_orgunit.name, 20, 90);
    doc.text("Implementer types: " + getUniqueImplementerTypes(updatedIndicators).join(", "), 20, 100);
    doc.addPage();
    doc.page = 1;
    for (var validationType in validationResults) {
        var result = validationResults[validationType];
        if (result.issues.length > 0) {
            var y = 30;
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            const issueTitle = "Issue: " + result.title;
            doc.text(issueTitle, 15, y, { maxWidth: 180 });
            var titleRows = Math.ceil(result.title.length / 180);
            titleRows > 1 ? y += titleRows * 15 : y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            const instructionText = result.instruction;
            doc.text(instructionText, 15, y, { maxWidth: 180});
            var instructionRows = Math.ceil(instructionText.length / 180);
            instructionRows > 1 ? y += instructionRows * 10 : y += 10;
            doc.autoTable({
                head: [result.headers.map(header => header.title)],
                body: result.issues,
                startY: y
            });
            doc.addPage();
        }
        else {
            doc.text("No issues found", 10, 10);
        }
    }
    addFooters(doc);
    doc.save("gf_adex_validation.pdf");
}

function indicatorNumeratorExpressionDescription(id) {
    for (var ind of updatedIndicators) {
        if (ind.id === id) return ind.numerator;
    }
    return "UNKNOWN";
}

export function configToCSV() {
    var csv_data = [];
    csv_data.push("\"ex_uid\",\"exchange_name\",\"request_name\",\"Code\",\"Short Name\",\"Indicator name\",\"Period type\",\"Numerator\", \"Implementer type\"");

    for (var ex of exchanges) {
        for (var req of ex.source.requests) {
            var periodType = classifyPeriods(req.pe);
            for (var ind of req.dx) {
                let csvrow = [];
                csvrow.push("\"" + ex.id + "\"");
                csvrow.push("\"" + ex.name + "\"");
                csvrow.push("\"" + req.name + "\"");
                csvrow.push("\"" + getIndicatorAttributeFromID(ind, "code", indicators) + "\"");
                csvrow.push("\"" + getIndicatorAttributeFromID(ind, "shortName", indicators) + "\"");
                csvrow.push("\"" + getIndicatorAttributeFromID(ind, "name", indicators) + "\"");
                csvrow.push("\"" + periodType + "\"");
                csvrow.push("\"" + indicatorNumeratorExpressionDescription(ind) + "\"");
                csv_data.push(csvrow.join(","));
            }
        }
    }

    csv_data = csv_data.join("\n");
    downloadCSVFile(csv_data);
}

function downloadCSVFile(csv_data) {
    var CSVFile = new Blob([csv_data], {
        type: "text/csv"
    });
    var temp_link = document.createElement("a");
    temp_link.download = "gf_indicator_config.csv";
    var url = window.URL.createObjectURL(CSVFile);
    temp_link.href = url;
    temp_link.style.display = "none";
    document.body.appendChild(temp_link);
    temp_link.click();
    document.body.removeChild(temp_link);
}

function replaceFormulasWithShortNames(indicators, operands, dataElements, dataSets) {
    const totalsMap = {};

    dataElements.dataElements.forEach(dataElement => {
        totalsMap[dataElement.id] = dataElement.shortName;
    });

    const detailsMap = {};
    operands.dataElementOperands.forEach(operand => {
        detailsMap[operand.dimensionItem] = operand.shortName;
    });

    const dataSetMap = {};
    dataSets.dataSets.forEach(dataSet => {
        dataSetMap[dataSet.id] = dataSet.name;
    });

    indicators.forEach(indicator => {
        if (indicator.numerator) {
            indicator.numerator = indicator.numerator.replace(/(\w+\.\w+)/g, match => {
                return detailsMap[match] || match;
            });
            indicator.numerator = indicator.numerator.replace(/(\w+)/g, match => {
                return totalsMap[match] || match;
            });

            indicator.numerator = indicator.numerator.replace(/(\w+)/g, match => {
                return dataSetMap[match] || match;
            });
        }

        if (indicator.denominator) {
            indicator.denominator = indicator.denominator.replace(/(\w+\.\w+)/g, match => {
                return detailsMap[match] || match;
            });
            indicator.denominator = indicator.denominator.replace(/(\w+)/g, match => {
                return totalsMap[match] || match;
            });

            indicator.denominator = indicator.denominator.replace(/(\w+)/g, match => {
                return dataSetMap[match] || match;
            });
        }
    });

    return indicators;
}

function metadataPackageIsPresent(metadataPackage) {
    //Does the package key exist?
    return metadataPackage?.package != undefined;
}

export async function runValidation() {
    //TODO: Fix this
    $("#validation-result").empty();
    $("#loading").show();
    console.log("Starting validation");

    //Get the stuff to validate
    systemInfo = await fetchSystemInfo();
    indicators = await fetchIndicators();
    exchanges = await fetchExchanges();
    root_orgunit = await fetchRootOrgUnit();
    operands = await fetchDataElementOperands();
    dataElements = await fetchDataElements();
    dataSets = await fetchDataSets();
    metadataPackage = await fetchIndicatorsFromDataStore();
    releaseInfo = await fetchPackageReleaseInfo();

    const remoteAppVersion = await fetchRemoteAppVersion();
    const localAppVersion = await fetchLocalAppVersion();
    checkAppVersion(remoteAppVersion, localAppVersion);

    Promise.all([systemInfo, exchanges, root_orgunit, indicators, operands, dataElements, dataSets, metadataPackage, releaseInfo])
        .then(console.log("Fetched metadata."))
        .catch((err) => {
            console.log(err);
            return false;
        });

    const metadataPackagePresent = metadataPackageIsPresent(metadataPackage);
    if (metadataPackagePresent) {

        checkMetadataPackageVersion(releaseInfo, metadataPackage);
        updatedIndicators = replaceFormulasWithShortNames(indicators, operands, dataElements, dataSets);

        //Categorize the indicators
        const classifiedIndicators = indicatorsCategorize(indicators);
        indicatorsConf = classifiedIndicators.indicatorsConf;
        indicatorsUnconf = classifiedIndicators.indicatorsUnconf;

        //Empty all of the "issues": [] arrays prior to a new validation run
        for (var validationType in validationResults) {
            validationResults[validationType].issues = [];
        }

        //If we do not have any exchanges, then we cannot check these
        if (exchanges.length > 0) {
            findDuplicatesInRequests(exchanges, validationResults);
            findUnconfiguredInRequests(exchanges, indicatorsUnconf, validationResults);
            findConfiguredNotInRequests(exchanges, indicatorsConf, validationResults);
            findNonAdexIndicatorsInRequests(exchanges, indicatorsUnconf, indicatorsConf, validationResults);
            findPublicAccess(exchanges, validationResults);
            findUserGroupAccess(exchanges, validationResults);
            findRequestPeriodInoncistenies(exchanges, indicators, indicatorpTypes, validationResults);
            findNonRelativePeriods(exchanges, validationResults);
            findWrongOutputIDScheme(exchanges, validationResults);
            findTargetAPI(exchanges, validationResults);
            findBasicAuth(exchanges, validationResults);
            validateRootOrgUnit(root_orgunit, exchanges, validationResults);
            validateExchangeTargetOuScheme(exchanges, validationResults);
            checkTargetOutputIdScheme(exchanges, validationResults);
            identifyUnknownIndicatorsInRequests(exchanges, indicators, metadataPackage);
            identifyMutuallyExclusiveAgeBands(indicatorsConf, exchanges);
            checkSingleImplementerType(indicatorsConf);
        } else {
            validationResults["EX_EXIST"].issues.push(["No exchanges found"]);
        }

        if (indicators.length > 0) {
            findChangedDenominators(indicators, validationResults);
            findChangedDecimals(indicators, validationResults);
            findInvalidImplementerTypes(indicators, validationResults);
        } else {
            validationResults["INDS_EXIST"].issues.push(["No GF ADEX indicators found"]);
        }

        validateOrgUnitCode(root_orgunit, validationResults);
        validateReferenceMetadata(metadataPackage);

        $("#loading").hide();
        $("#download-summary-csv").prop("disabled", false);
        $("#download-report-pdf").prop("disabled", false);
        printValidationResults(validationResults);
    } else {
        $("#loading").hide();
        alert("The GFADEX metadata package is not present. Please import the GFADEX package into the datastore first!");
    }

}

export class ValidationReport extends HTMLElement {

    connectedCallback() {
        this.innerHTML = `
            <h2 data-i18n="validation-report.title"></h2>
            <table id="downloads">
            <tr>
                <td>
                    <button id="run-validation" onclick="runValidation()" data-i18n="validation-report.run-validation-btn"></button>
                </td>
                <td>
                    <button id="download-summary-csv" type="button" onclick="configToCSV()" disabled="disabled" data-i18n="validation-report.download-summary-btn">
                        Download Exchange Summary
                    </button>
                </td>
                <td>
                    <button id="download-report-pdf" type="button" onclick="reportToPDF()" disabled="disabled" data-i18n="validation-report.download-report-btn">
                        Download Report (PDF)
                    </button>
                </td>
            </tr>
           </table>
           <div id="loading" style="display:none" >
           <h1 data-i18n="loading">Loading...please wait.</h1>
           <img alt=""
               src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8c3ZnIHdpZHRoPSI0MHB4IiBoZWlnaHQ9IjQwcHgiIHZpZXdCb3g9IjAgMCA0MCA0MCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWw6c3BhY2U9InByZXNlcnZlIiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjEuNDE0MjE7IiB4PSIwcHgiIHk9IjBweCI+CiAgICA8ZGVmcz4KICAgICAgICA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPjwhW0NEQVRBWwogICAgICAgICAgICBALXdlYmtpdC1rZXlmcmFtZXMgc3BpbiB7CiAgICAgICAgICAgICAgZnJvbSB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIC13ZWJraXQtdHJhbnNmb3JtOiByb3RhdGUoLTM1OWRlZykKICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0KICAgICAgICAgICAgQGtleWZyYW1lcyBzcGluIHsKICAgICAgICAgICAgICBmcm9tIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKC0zNTlkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICAgIHN2ZyB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46IDUwJSA1MCU7CiAgICAgICAgICAgICAgICAtd2Via2l0LWFuaW1hdGlvbjogc3BpbiAxLjVzIGxpbmVhciBpbmZpbml0ZTsKICAgICAgICAgICAgICAgIC13ZWJraXQtYmFja2ZhY2UtdmlzaWJpbGl0eTogaGlkZGVuOwogICAgICAgICAgICAgICAgYW5pbWF0aW9uOiBzcGluIDEuNXMgbGluZWFyIGluZmluaXRlOwogICAgICAgICAgICB9CiAgICAgICAgXV0+PC9zdHlsZT4KICAgIDwvZGVmcz4KICAgIDxnIGlkPSJvdXRlciI+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwwQzIyLjIwNTgsMCAyMy45OTM5LDEuNzg4MTMgMjMuOTkzOSwzLjk5MzlDMjMuOTkzOSw2LjE5OTY4IDIyLjIwNTgsNy45ODc4MSAyMCw3Ljk4NzgxQzE3Ljc5NDIsNy45ODc4MSAxNi4wMDYxLDYuMTk5NjggMTYuMDA2MSwzLjk5MzlDMTYuMDA2MSwxLjc4ODEzIDE3Ljc5NDIsMCAyMCwwWiIgc3R5bGU9ImZpbGw6YmxhY2s7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNNS44NTc4Niw1Ljg1Nzg2QzcuNDE3NTgsNC4yOTgxNSA5Ljk0NjM4LDQuMjk4MTUgMTEuNTA2MSw1Ljg1Nzg2QzEzLjA2NTgsNy40MTc1OCAxMy4wNjU4LDkuOTQ2MzggMTEuNTA2MSwxMS41MDYxQzkuOTQ2MzgsMTMuMDY1OCA3LjQxNzU4LDEzLjA2NTggNS44NTc4NiwxMS41MDYxQzQuMjk4MTUsOS45NDYzOCA0LjI5ODE1LDcuNDE3NTggNS44NTc4Niw1Ljg1Nzg2WiIgc3R5bGU9ImZpbGw6cmdiKDIxMCwyMTAsMjEwKTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwzMi4wMTIyQzIyLjIwNTgsMzIuMDEyMiAyMy45OTM5LDMzLjgwMDMgMjMuOTkzOSwzNi4wMDYxQzIzLjk5MzksMzguMjExOSAyMi4yMDU4LDQwIDIwLDQwQzE3Ljc5NDIsNDAgMTYuMDA2MSwzOC4yMTE5IDE2LjAwNjEsMzYuMDA2MUMxNi4wMDYxLDMzLjgwMDMgMTcuNzk0MiwzMi4wMTIyIDIwLDMyLjAxMjJaIiBzdHlsZT0iZmlsbDpyZ2IoMTMwLDEzMCwxMzApOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksMjguNDkzOUMzMC4wNTM2LDI2LjkzNDIgMzIuNTgyNCwyNi45MzQyIDM0LjE0MjEsMjguNDkzOUMzNS43MDE5LDMwLjA1MzYgMzUuNzAxOSwzMi41ODI0IDM0LjE0MjEsMzQuMTQyMUMzMi41ODI0LDM1LjcwMTkgMzAuMDUzNiwzNS43MDE5IDI4LjQ5MzksMzQuMTQyMUMyNi45MzQyLDMyLjU4MjQgMjYuOTM0MiwzMC4wNTM2IDI4LjQ5MzksMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxMDEsMTAxLDEwMSk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMy45OTM5LDE2LjAwNjFDNi4xOTk2OCwxNi4wMDYxIDcuOTg3ODEsMTcuNzk0MiA3Ljk4NzgxLDIwQzcuOTg3ODEsMjIuMjA1OCA2LjE5OTY4LDIzLjk5MzkgMy45OTM5LDIzLjk5MzlDMS43ODgxMywyMy45OTM5IDAsMjIuMjA1OCAwLDIwQzAsMTcuNzk0MiAxLjc4ODEzLDE2LjAwNjEgMy45OTM5LDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoMTg3LDE4NywxODcpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTUuODU3ODYsMjguNDkzOUM3LjQxNzU4LDI2LjkzNDIgOS45NDYzOCwyNi45MzQyIDExLjUwNjEsMjguNDkzOUMxMy4wNjU4LDMwLjA1MzYgMTMuMDY1OCwzMi41ODI0IDExLjUwNjEsMzQuMTQyMUM5Ljk0NjM4LDM1LjcwMTkgNy40MTc1OCwzNS43MDE5IDUuODU3ODYsMzQuMTQyMUM0LjI5ODE1LDMyLjU4MjQgNC4yOTgxNSwzMC4wNTM2IDUuODU3ODYsMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxNjQsMTY0LDE2NCk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMzYuMDA2MSwxNi4wMDYxQzM4LjIxMTksMTYuMDA2MSA0MCwxNy43OTQyIDQwLDIwQzQwLDIyLjIwNTggMzguMjExOSwyMy45OTM5IDM2LjAwNjEsMjMuOTkzOUMzMy44MDAzLDIzLjk5MzkgMzIuMDEyMiwyMi4yMDU4IDMyLjAxMjIsMjBDMzIuMDEyMiwxNy43OTQyIDMzLjgwMDMsMTYuMDA2MSAzNi4wMDYxLDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoNzQsNzQsNzQpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksNS44NTc4NkMzMC4wNTM2LDQuMjk4MTUgMzIuNTgyNCw0LjI5ODE1IDM0LjE0MjEsNS44NTc4NkMzNS43MDE5LDcuNDE3NTggMzUuNzAxOSw5Ljk0NjM4IDM0LjE0MjEsMTEuNTA2MUMzMi41ODI0LDEzLjA2NTggMzAuMDUzNiwxMy4wNjU4IDI4LjQ5MzksMTEuNTA2MUMyNi45MzQyLDkuOTQ2MzggMjYuOTM0Miw3LjQxNzU4IDI4LjQ5MzksNS44NTc4NloiIHN0eWxlPSJmaWxsOnJnYig1MCw1MCw1MCk7Ii8+CiAgICAgICAgPC9nPgogICAgPC9nPgo8L3N2Zz4K" />
           </div>
           <div id="validation-result" width="100%"></div>
            `;
    }
}