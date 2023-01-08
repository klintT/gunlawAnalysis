const xToJson = require('convert-excel-to-json');
const calculateCorrelation = require("calculate-correlation");
const fs = require('fs');

const INCIDENT = 'INCIDENT';
const SHOOTER = 'SHOOTER';
const VICTIM = 'VICTIM';
const WEAPON = 'WEAPON';
const GUNLAWS = 'GUNLAWS';

const STATE_ACRONYMS = {
    'Alaska': 'AK',
    'Alabama': 'AL',
    'Arkansas': 'AR',
    'Arizona': 'AZ',
    'California': 'CA',
    'Colorado': 'CO',
    'Connecticut': 'CT',
    'Washington DC': 'DC',
    'Delaware': 'DE',
    'Florida': 'FL',
    'Georgia': 'GA',
    'Hawaii': 'HI',
    'Iowa': 'IA',
    'Idaho': 'ID',
    'Illinois': 'IL',
    'Indiana': 'IN',
    'Kansas': 'KS',
    'Kentucky': 'KY',
    'Louisiana': 'LA',
    'Massachusetts': 'MA',
    'Maryland': 'MD',
    'Maine': 'ME',
    'Michigan': 'MI',
    'Minnesota': 'MN',
    'Missouri': 'MO',
    'Mississippi': 'MS',
    'Montana': 'MT',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Nebraska': 'NE',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'Nevada': 'NV',
    'New York': 'NY',
    'Ohio': 'OH',
    'Oklahoma': 'OK',
    'Oregon': 'OR',
    'Pennsylvania': 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    'Tennessee': 'TN',
    'Texas': 'TX',
    'Utah': 'UT',
    'Virginia': 'VA',
    'Virgin Islands': 'VI',
    'Vermont': 'VT',
    'Washington': 'WA',
    'Wisconsin': 'WI',
    'West Virginia': 'WV',
    'Wyoming': 'WY'
};

class GunLawsToSchoolShootings {
    constructor() {
        this.shootingData = xToJson({
            sourceFile: './combined-data.xlsx',
            header: {
                rows: 1,
            },
            columnToKey: {
                '*': '{{columnHeader}}'
            }
        });

        this.populationData = JSON.parse(fs.readFileSync('population_data.json', 'utf8'));
    }

    getStatesByIncidentCountByPopPercentage() {
        let stateIncidents = this.getStatesByIncidentCount();
        for (let i in stateIncidents) {
            let stateName = this.getStateByAcronym(i);
            let popPercentage = this.getPopulationPercentageDataByState(stateName)
            stateIncidents[i] = Math.ceil(stateIncidents[i] * (1 + popPercentage));
        }
        return stateIncidents;
    }

    getStatesByByIncidentsScaledByPopulation() {
        let stateIncidents = this.getStatesByIncidentCount();
        let statePops = [];
        for (let i in stateIncidents) {
            let stateName = this.getStateByAcronym(i);
            let pop = this.getPopulationDataByState(stateName);
            statePops[i] = pop;
        }

        let lowestPop = Infinity;
        for (let i in statePops) {
            if (lowestPop > statePops[i]) {
                lowestPop = statePops[i];
            }
        }

        for (let i in stateIncidents) {
            // incidentsScaled = total incidents / (state pop / lowest pop )
            stateIncidents[i] = stateIncidents[i] / (statePops[i] / lowestPop);
        }

        return stateIncidents;
    }

    getStatesByIncidentCount() {
        let stateIncidents = [];
        for (let i in this.shootingData[INCIDENT]) {
            let incident = this.shootingData[INCIDENT][i];
            if (stateIncidents[incident['State']] == null) {
                stateIncidents[incident['State']] = 1;
            } else {
                stateIncidents[incident['State']] += 1;
            }
        }

        return stateIncidents;
    }

    getLawsPerState() {
        let stateLaws = [];
        for (let i in this.shootingData[GUNLAWS]) {
            let laws = this.shootingData[GUNLAWS][i];
            if (stateLaws[laws['state']] == null && laws['year'] === 2020) {
                stateLaws[laws['state']] = laws['lawtotal'];
            }
        }

        return stateLaws;
    }

    objectToArray(ob) {
        let array = [];
        for (let i in ob) {
            array.push([i, ob[i]]);
        }
        return array;
    }

    getMedianNumberGunLaws() {
        let lawsPerState = this.getLawsPerState();
        lawsPerState = this.objectToArray(lawsPerState).sort((a, b) => { return b[1] - a[1] });       
        return lawsPerState[24][1];
    }

    getStateByAcronym(acronym) {
        for (let i in STATE_ACRONYMS) {
            if (STATE_ACRONYMS[i] == acronym) {
                return i;
            }
        }

        throw new Error("Can't find state: " + acronym);
    }

    getPopulationPercentageDataByState(state) {
        for (let i in this.populationData) {
            if (this.populationData[i]['State'] == state) {
                return parseFloat(this.populationData[i]['Percent'])
            }
        }

        throw new Error("Can't find population percentage data: " + state);
    }

    getPopulationDataByState(state) {
        for (let i in this.populationData) {
            if (this.populationData[i]['State'] == state) {
                return parseFloat(this.populationData[i]['Pop'])
            }
        }

        throw new Error("Can't find population percentage data: " + state);
    }
}

gunLaws = new GunLawsToSchoolShootings();

let results = [];

let laws = gunLaws.objectToArray(gunLaws.getLawsPerState());
for (let i in laws) {
    if (results[laws[i][0]] == null) {
        results[laws[i][0]] = {
            'numLaws': laws[i][1]
        }
    }
}

let stateIncidents = gunLaws.getStatesByByIncidentsScaledByPopulation();
stateIncidents = gunLaws.objectToArray(stateIncidents).sort((a, b) => { return b[1] - a[1] });
for (let i in stateIncidents) {
    let state = gunLaws.getStateByAcronym(stateIncidents[i][0]);
    if (results[state] != null) {
        results[state] = {
            ...results[state],
            'stateIncidentsScaledByPop': stateIncidents[i][1]
        }
    }
}

stateIncidents = gunLaws.getStatesByIncidentCount();
stateIncidents = gunLaws.objectToArray(stateIncidents).sort((a, b) => { return b[1] - a[1] });
for (let i in stateIncidents) {
    let state = gunLaws.getStateByAcronym(stateIncidents[i][0]);
    if (results[state] != null) {
        results[state] = {
            ...results[state],
            'stateIncidents': stateIncidents[i][1]
        }
    }
}

let aboveAverageGunLawsIncidents = 0;
let belowAverageGunLawsIncidents = 0;

let aboveAverageGunLawsIncidentsScaled = 0;
let belowAverageGunLawsIncidentsScaled = 0;

let medianGunLaws = gunLaws.getMedianNumberGunLaws();
for (let i in results) {
    let result = results[i];
    if (result['numLaws'] > medianGunLaws) {
        aboveAverageGunLawsIncidents += result['stateIncidents'];
        aboveAverageGunLawsIncidentsScaled += result['stateIncidentsScaledByPop'];
    } else {
        belowAverageGunLawsIncidents += result['stateIncidents'];
        belowAverageGunLawsIncidentsScaled += result['stateIncidentsScaledByPop'];
    }
}

let lawArray = [];
let incidentArray = [];
for (let i in results) {
    lawArray.push(results[i].numLaws);
    incidentArray.push(results[i].stateIncidentsScaledByPop);
}
console.log('Pearson correlation coefficient: ')
console.log(calculateCorrelation(lawArray, incidentArray));

console.log('')
console.log('Above Average Gun Law Incidents: ' + aboveAverageGunLawsIncidents);
console.log('Above Average Gun Law Incidents Scaled: ' + aboveAverageGunLawsIncidentsScaled);

console.log('')
console.log('Below Average Gun Law Incidents: ' + belowAverageGunLawsIncidents);
console.log('Below Average Gun Law Incidents Scaled: ' + belowAverageGunLawsIncidentsScaled);

results = gunLaws.objectToArray(results);
for (let i in results) {
    //console.log(results[i])
}