const getRelevantFields = (bbCodeVersion) => {
    switch (bbCodeVersion) {
        case 1: // Death Report
            return [
                'coronerRank', 'placeOfDeath', 'department', 'dateTime', 'coronerEmployee',
                'coronerBadge', 'decedentName', 'decedentOOC', 'pronouncedTimeOfDeath',
                'synopsis', 'probableCauseOfDeath', 'mannerOfDeath', 'typeOfDeath',
                'scenePhotos', 'additionalImages', 'requestingOfficer',
            ];
        case 2: // Email Generator
            return [
                'requestingOfficer', 'department', 'coronerEmployee', 'coronerRank',
                'coronerDiscord', 'coronerPHNumber', 'deathReport', 'additionalReports'
            ];
        case 3: // Patient File - Advanced
            return [
                'patientName', 'patientAddress', 'patientRace', 'patientGender', 'patientPH',
                'patientDiscord', 'patientEmergencyContact', 'patientEmergencyContactNumber',
                'patientEmergencyContactRelation', 'patientEmergencyContactDiscord', 'patientTitle',
                'patientAllergies', 'patientCurrentMedicine', 'patientChronicDiseases', 'patientNotes',
                'date', 'patientID', 'patientTherapy', 'patientTriggers', 'patientSupport',
                'patientHarm', 'patientFam', 'patientGenetic', 'patientMental', 'patientFamSocial',
                'patientReligion', 'attorneyName', 'attorneyRelation', 'attorneyPH', 'patientDateOfBirth',
                'patientSmoker', 'patientAlcohol', 'patientDrugs', 'patientExercise', 'patientDiet',
                'patientSleep', 'patientSexLife', 'patientJobRisks', 'patientHazards', 'patientOther',
                'dnrOther', 'decedentOOC', 'maritalStatus', 'numberChildren', 'financialStatus', 'dnr', 'dnrOrder', 'attorney'
            ];
        case 4: // Autopsy Report
            return [
                'coronerEmployee',
                'coronerRank',
                'coronerBadge',
                'decedentName',
                'decedentOOC',
                'autopsyDate',
                'autopsyTime',
                'placeOfDeath',
                'causeOfDeath', // Corrected: removed backticks
                'deathType',
                'autopsyDeathCauses',
                'externalExamination',
                'internalExamination',
                'evidenceRecovered',
                'autopsyAnatomicSummaryItems',
                'autopsyAlbumUrl', // Keep one instance for general autopsy photos
                'autopsyPhotosUnavailable',
                'additionalNotes',
                'synopsis',
                'RadiologyResult', // Added from your Autopsy.js component
                'autopsyDiagramImgurUrl', // Added: URL for the saved diagram image
                'autopsyDiagramMarkers',  // Added: Marker data for the diagram (if you want to save for re-editing)
                // Add any other fields specific to your Autopsy form component
            ];
        case 5: // Surgery Report
            return [
                'phmcEmployee', 'lastName', 'extraStaff', 'patientID', 'patientSummaryConsultation',
                'patientAddress', 'rank', 'date', 'patientSummary', 'lastName',
                'surgeryProcedures', 'patientConsentOption', 'patientComplicationOptions',
                'procedureGoodOptions'
            ];
        case 6: // Physical Evaluation (PHMC)
            return [
                'phmcEmployee', 'lastName', 'patientName',
                'patientID', 'date', 'lastName', 'patientHeight', 'patientWeight',
                'phmcRank', 'careerRisks', 'patientAllergies', 'patientMedicine',
                'patientcareerNo', 'patientSummary', 'patientCareer', 'patientImpairments',
                'BodyMassIndex', 'temperature', 'heartRate', 'breathing', 'bloodPressure',
                'patientJob', 'patientJobRisks', 'patientOther', 'predisposition'
            ];
        case 7: // Physical Evaluation (PBC)
            return [
                'phmcEmployee', 'lastName', 'patientName',
                'patientID', 'date', 'lastName', 'patientHeight', 'patientWeight',
                'phmcRank', 'careerRisks', 'patientAllergies', 'patientMedicine',
                'patientcareerNo', 'patientSummary', 'patientCareer', 'patientImpairments',
                'BodyMassIndex', 'temperature', 'heartRate', 'breathing', 'bloodPressure',
                'patientJob', 'patientJobRisks', 'patientOther', 'predisposition'
            ];
        case 9: // Obs Main File
            return [
                'phmcEmployee', 'lastName', 'patientName', 'patientMedicalRecord', 'patientJob',
                'patientPartnerPH', 'patientDateofBirth', 'patientPartnerName', 'patientJobTasks',
                'patientLivingHabits', 'patientPreHealth', 'patientBaggageofParents', 'patientTemperature',
                'patientBP', 'patientWeight', 'patientSummaryConsultation', 'patientBPM',
                'patientResperation', 'patientOxi', 'patientDateofPregnancy', 'patientFetalMeasurements',
                'patientWellWomanExam', 'patientPapResults', 'patientSTI', 'patientSTIResults',
                'patientHeight', 'patientBloodAnalysis', 'patientBloodAnalysisResults', 'patientUrine',
                'patientUrineResults', 'date', 'patientPap', 'patientPartnerDiscord',
                'phmcSignature', 'patientAdditionalPregnancy', 'patientPregProblems',
                'oneFetus', 'twoFetuses', 'threeFetuses', 'fourFetuses'
            ];
        case 10: // Obs Follow Up
            return [
                'phmcEmployee', 'lastName', 'patientName', 'patientMedicalRecord', 'patientContractions',
                'patientBleeding', 'patientDateofBirth', 'patientDiscomfort', 'patientFatter',
                'patientBabyGender', 'patientKnowBabyGender', 'patientTemperature', 'patientBP',
                'patientWeight', 'patientSummaryConsultation', 'patientBPM', 'patientResperation',
                'patientOxi', 'patientDateofPregnancy', 'patientFetalMeasurements', 'patientBloodAnalysis',
                'patientBloodAnalysisResults', 'patientUrine', 'patientUrineResults', 'date',
                'patientUltraSummary', 'phmcSignature'
            ];
/*         case 11: // Mass Fatality Report
            return [
                'decedents', 'coronerRank', 'placeOfDeath', 'department', 'dateTime',
                'coronerEmployee', 'coronerBadge', 'synopsis', 'requestingOfficer',
                'decedentName', 'decedentOOC',
            ];
 */        case 12: // Gynecology - Main File
            return [
                'phmcEmployee', 'lastName', 'patientName', 'patientMedicalRecord', 'patientJob',
                'patientPartnerPH', 'patientDateofBirth', 'patientPartnerName', 'patientJobTasks',
                'patientLivingHabits', 'patientBaggageofParents', 'patientTemperature', 'patientBP',
                'patientWeight', 'patientSummaryConsultation', 'patientBPM', 'patientResperation',
                'patientOxi', 'patientNotes', 'patientWellWomanExam', 'patientPapResults',
                'patientSTI', 'patientSTIResults', 'patientHeight', 'patientBloodAnalysis',
                'patientBloodAnalysisResults', 'patientUrine', 'patientUrineResults', 'date',
                'patientPap', 'patientPartnerDiscord', 'phmcSignature', 'patientAdditionalPregnancy',
                'patientPregProblems'
            ];
        case 13: // Gynecology - Add Reply
            return [
                'phmcEmployee', 'lastName', 'patientName', 'patientMedicalRecord', 'patientBleeding',
                'patientDateofBirth', 'patientDiscomfort', 'patientFatter', 'patientTemperature',
                'patientBP', 'patientWeight', 'patientSummaryConsultation', 'patientBPM',
                'patientResperation', 'patientOxi', 'patientBloodAnalysis', 'patientBloodAnalysisResults',
                'patientUrine', 'patientUrineResults', 'date', 'patientUltraSummary',
                'phmcSignature'
            ];
        case 14: // Mental Health - PHMC
            return [
                'phmcEmployee', 'lastName', 'patientName',
                'lastName', 'patientID', 'date', 'patientChiefComplaint', 'rank',
                'patientNotes', 'patientDiagnosis', 'patientMedicine', 'patientProcedure'
            ];
        case 16: // Mental Health - PBC
            return [
                'phmcEmployee', 'lastName', 'patientName',
                'lastName', 'patientID', 'rank', 'date', 'patientChiefComplaint',
                'patientNotes', 'patientDiagnosis', 'patientMedicine', 'patientProcedure'
            ];
        case 18: // Agency Feedback
            return [
                'coronerRank', 'coronerEmployee', 'placeOfDeath', 'department',
                'dateTime', 'decedentName', 'synopsis', 'scenePhotos'
            ];
        case 19: // Emergency Room Protocols
            return [
                'lastName', 'phmcRank', 'patientID', 'date', 'patientDiagnosis',
                'patientSecondaryDiagnosis', 'patientMedicine', 'patientProcedure',
                'patientChiefComplaint', 'painLevel', 'temperature', 'heartRate', 'breathing',
                'bloodPressure', 'findings', 'lungs', 'pupils', 'wounds', 'ecg', 'sono', 'lab', 'admission'
            ];
        case 20: // Consultation Notes (PHMC)
            return [
                'lastName', 'phmcRank', 'patientID', 'date', 'patientDiagnosis',
                'patientSecondaryDiagnosis', 'patientMedicine', 'patientProcedure',
                'patientChiefComplaint', 'temperature', 'heartRate', 'breathing', 'bloodPressure',
                'findings', 'lungs', 'pupils', 'wounds', 'ecg', 'sono', 'lab', 'admission',
                'assignedDepartment'
            ];
        case 21: // Consultation Notes (PBC)
            return [
                'lastName', 'phmcRank', 'patientID', 'date', 'patientDiagnosis',
                'patientSecondaryDiagnosis', 'patientMedicine', 'patientProcedure',
                'patientChiefComplaint', 'temperature', 'heartRate', 'breathing', 'bloodPressure',
                'findings', 'lungs', 'pupils', 'wounds', 'ecg', 'sono', 'lab', 'admission',
                'paletoClinicDepartment', 'patientNotes'
            ];
        case 22: // Commentary Note (PHMC)
            return [
                'phmcEmployee', 'lastName',
                'date',
                'patientID',
                'departmentLarge',
            ];
        case 23: // Commentary Note (PBC)
            return [
                'phmcEmployee', 'lastName',
                'date',
                'patientID',
                'departmentLarge',
            ];
        case 24: // Medical Release Records
            return [
                'patientFirstName',
                'patientMiddleName',
                'patientLastName',
                'patientPH',
                'patientDateOfBirth',
                'patientAddress',
                'patientZIP',
                'patientEmail',
                'patientMedInfoReleaseOther',
                'phmcEmployee', 'lastName',
                'MedicalRecordsReleaseOther',
                'patientMedInfoFormatOther',
                'StupidDateFrom',
                'StupidDateTo',
                'SubmitDate',
                'MedicalRecordsRelease',
                'CarePurposeMedicalInformationRelease',
                'PurposeMedicalInformationReleaseFormat',
                'payNow', 
                'paymentProofPhotos' 
        
            ];
        case 25: // Patient File - Basic
            return [
                'patientName',
                'patientAddress',
                'patientRace',
                'patientGender',
                'patientPH',
                'patientDiscord',
                'patientEmergencyContact',
                'patientEmergencyContactNumber',
                'patientEmergencyContactRelation',
                'patientEmergencyContactDiscord',
                'patientTitle',
                'patientAllergies',
                'patientCurrentMedicine',
                'patientChronicDiseases',
                'patientNotes',
                'date',
                'patientID',
                'patientBloodType',
            ];
        case 26: // Patient File - Advanced
            return [
                'patientName',
                'patientAddress',
                'patientRace',
                'patientGender',
                'patientPH',
                'patientDiscord',
                'patientEmergencyContact',
                'patientEmergencyContactNumber',
                'patientEmergencyContactRelation',
                'patientEmergencyContactDiscord',
                'patientTitle',
                'patientAllergies',
                'patientCurrentMedicine',
                'patientChronicDiseases',
                'patientNotes',
                'date',
                'patientID',
                'patientBloodType',
            ];
        case 27: // Email Forms
            return [
                'scenePhotos',
                'decedentName',
                'patientNotes',
                'synopsis',
                'phmcEmployee', 'lastName',
                'decedentOOC',
                'patientCareer',
            ];
        case 28: // Psychological Evaluation PHMC
            return [
                'patientID',
                'date',
                'phmcRank',
                'lastName',
                'patientChiefComplaint',
                'patientTriggers',
                'patientStress',
                'patientTreatment',
                'patientFamily',
                'patientJobRisks',
                'patientMedicalRecord',
                'patientAllergies',
                'patientChronicDiseases',
                'patientVisitReason',
                'patientSymptoms',
                'patientCondition',
                'patientDrugs',
                'patientDrugsUsage',
                'patientMental',
                'patientJob',
                'patientFam',
                'patientLegal',
                'patientRelationship',
                'patientFindings',
                'patientTreatmentPlan',
                'patientSafety',
                'patientFollowUp',
                'patientTreatmentMedicine',
                'patientDiagnosis',
                'patientTherapy',
                'patientRiskAssessment',
                'patientTherapyMedicine',
                'Speech',
                'Behavior',
                'Appearance',
                'Mood',
                'Affect',
                'Risk',
                'ThoughtProcess',
                'ThoughtContent',
                'Insight',
                'Cognition',
                'admission',
                'followup',
            ];
        case 29: // Psychological Evaluation PBC
            return [
                'patientID',
                'date',
                'phmcRank',
                'lastName',
                'patientChiefComplaint',
                'patientTriggers',
                'patientStress',
                'patientTreatment',
                'patientFamily',
                'patientJobRisks',
                'patientMedicalRecord',
                'patientAllergies',
                'patientChronicDiseases',
                'patientVisitReason',
                'patientSymptoms',
                'patientCondition',
                'patientDrugs',
                'patientDrugsUsage',
                'patientMental',
                'patientJob',
                'patientFam',
                'patientLegal',
                'patientRelationship',
                'patientFindings',
                'patientTreatmentPlan',
                'patientSafety',
                'patientFollowUp',
                'patientTreatmentMedicine',
                'patientDiagnosis',
                'patientTherapy',
                'patientRiskAssessment',
                'patientTherapyMedicine',
                'Speech',
                'Behavior',
                'Appearance',
                'Mood',
                'Affect',
                'Risk',
                'ThoughtProcess',
                'ThoughtContent',
                'Insight',
                'Cognition',
                'admission',
                'followup',
            ];
        default:
            return []; // Or return a default set of fields
    }
};

export default getRelevantFields;