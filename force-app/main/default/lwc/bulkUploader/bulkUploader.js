import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { exportCSVFile, headerArrayToJSON } from 'c/commonUtils';
import getSessionId from '@salesforce/apex/CommonUtils.getSessionId';
import getSessionIdFromInternal from '@salesforce/apex/CommonUtils.getSessionIdFromInternal';
import getOrgDomainUrlExternalForm from '@salesforce/apex/CommonUtils.getOrgDomainUrlExternalForm';

const MAX_FILE_SIZE = 1500000;

export default class BulkUploader extends LightningElement {

    @api recordId;
    @api externalIdFieldNameRef;
    @api objectApiNameRef;
    @api operationRef;
    @api csvTemplateFieldsRef;

    objectApiName;
    externalIdFieldName;
    operation;
    csvTemplateFields;
    fileData;
    isLoading = false;
    bulkApiV2EndpointUrl;
    sessionId;
    decodedFileContent;
    isDatatableProcessing = false;

    @track bulkJob;
    @track uploadedFiles;
    @track csvTemplateColumns;
    @track parsedCsvContent;

    connectedCallback() {
        this.objectApiName = this.objectApiNameRef ? this.objectApiNameRef.slice() : null;
        this.externalIdFieldName = this.externalIdFieldNameRef ? this.externalIdFieldNameRef.slice() : null;
        this.operation = this.operationRef ? this.operationRef.slice() : null;
        this.csvTemplateFields = this.csvTemplateFieldsRef ? this.csvTemplateFieldsRef.slice() : null;
    }

    get acceptedFormats() {
        return [
            '.csv'
        ];
    }

    handleInputBlur(event) {
        const { dataset, value } = event.currentTarget;
        const { field } = dataset;

        this[field] = value;
    }

    processBulkUpload(blobData) {
        const bulkApiV2Endpoint = '/services/data/v56.0/jobs/ingest';

        this.bulkApiV2EndpointUrl = null;
        this.sessionId = null;
        this.isLoading = true;

        getOrgDomainUrlExternalForm().then(orgDomainUrlExternalFormResult => {
            if (orgDomainUrlExternalFormResult) {
                this.bulkApiV2EndpointUrl = orgDomainUrlExternalFormResult + bulkApiV2Endpoint;

                console.log('~ processBulkUpload -> getOrgDomainUrlExternalForm -> this.bulkApiV2EndpointUrl', this.bulkApiV2EndpointUrl);

                return getSessionIdFromInternal();

            } else {
                throw 'Error on generating Bulk API Endpoint!';
            }

        }).then(sessionIdResult => {
            if (sessionIdResult) {
                this.sessionId = sessionIdResult;

                console.log('~ processBulkUpload -> getSessionIdFromInternal -> this.sessionId', this.sessionId);
                console.log('~ processBulkUpload -> getSessionIdFromInternal -> this.externalIdFieldName', this.externalIdFieldName);
                console.log('~ processBulkUpload -> getSessionIdFromInternal -> this.operation', this.operation);
                console.log('~ processBulkUpload -> getSessionIdFromInternal -> this.objectApiName', this.objectApiName);
                console.log('~ processBulkUpload -> getSessionIdFromInternal -> this.bulkApiV2EndpointUrl', this.bulkApiV2EndpointUrl);

                return fetch(this.bulkApiV2EndpointUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.sessionId 
                    }, 
                    body: JSON.stringify({
                        externalIdFieldName: this.externalIdFieldName, 
                        lineEnding: 'CRLF', 
                        operation: this.operation, 
                        object: this.objectApiName, 
                        contentType: 'CSV' 
                    })
                });

            } else {
                throw 'No Session ID has been generated! ' + sessionIdResult;
            }

        }).then(response => {
            console.log('~ processBulkUpload -> fetch -> response', response);

            if (response.status < 300) {
                return response.json();

            } else {
                throw response.status + ': ' + response.statusText;
            }

        }).then(bulkJobFirstResponse => {
            if (bulkJobFirstResponse) {
                this.bulkJob = bulkJobFirstResponse;

                console.log('~ processBulkUpload -> response.json() -> bulkJobFirstResponse', bulkJobFirstResponse);

                return fetch(this.bulkApiV2EndpointUrl + '/' + this.bulkJob.id + '/batches', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'text/csv',
                        'Authorization': 'Bearer ' + this.sessionId 
                    }, 
                    body: blobData
                });

            } else {
                throw 'Bulk Job first response has failed!';
            }

        }).then(response => {
            console.log('~ processBulkUpload -> fetch -> response', response);

            if (response.status < 300) {
                return fetch(this.bulkApiV2EndpointUrl + '/' + this.bulkJob.id, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.sessionId 
                    }, 
                    body: JSON.stringify({
                        state: 'UploadComplete' 
                    })
                });

            } else {
                throw response.status + ': ' + response.statusText;
            }

        }).then(response => {
            console.log('~ processBulkUpload -> fetch -> response', response);

            if (response.status < 300) {
                return response.json();

            } else {
                throw response.status + ': ' + response.statusText;
            }

        }).then(bulkJobThirdResponse => {
            console.log('~ processBulkUpload -> response.json() -> bulkJobThirdResponse', bulkJobThirdResponse);

            if (bulkJobThirdResponse) {
                this.bulkJob = bulkJobThirdResponse;

                this.toast('Data processing has been started. Bulk Data Load Job ID: ' + this.bulkJob.id, 'success');

            } else {
                throw 'Bulk Job last response has failed!';
            }

        }).catch(error => {
            console.error('processBulkUpload -> callout error ===> ', error);

            this.toast(error, 'error');

        }).finally(() => {
            this.isLoading = false;
        });
    }

    handleFileChange(event) {
        this.uploadedFiles = event.target.files;
        this.decodedFileContent = null;
        this.parsedCsvContent = null;
        this.isDatatableProcessing = true;

        console.log('~ handleFileChange -> this.uploadedFiles', this.uploadedFiles);

        if (this.uploadedFiles && this.uploadedFiles.length > 0) {
            const file = this.uploadedFiles[0];

            if (file.size > MAX_FILE_SIZE) {
                this.toast('File size must not exceed ' + MAX_FILE_SIZE + ' bytes.', 'error');

            } else {
                let reader = new FileReader();

                reader.onload = () => {
                    const fileContent = reader.result.split(',')[1];

                    this.decodedFileContent = atob(fileContent);
                    this.isDatatableProcessing = false;

                    console.log('~ handleFileChange -> this.decodedFileContent', this.decodedFileContent);
                }

                reader.readAsDataURL(file);
            }
        }
    }

    uploadFileAndProcessBulkUpload() {
        if (!this.disabledProcessBulkUploadButton && this.decodedFileContent) {
            this.processBulkUpload(this.decodedFileContent);
        }
    }

    getBulkUploadState() {
        this.isLoading = true;

        fetch(this.bulkApiV2EndpointUrl + '/' + this.bulkJob.id, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.sessionId 
            }

        }).then(response => {
            if (response.status < 300) {
                return response.json();

            } else {
                throw response.status + ': ' + response.statusText;
            }

        }).then(bulkJobResponse => {
            if (bulkJobResponse) {
                this.bulkJob = bulkJobResponse;

            } else {
                throw 'Bulk Job response has failed!';
            }

        }).catch(error => {
            console.log('callout error -> ', error);

            this.toast(error, 'error');

        }).finally(() => {
            this.isLoading = false;
        })
    }

    getJobSuccessfulRecordResults() {
        this.getJobRecordResults('successfulResults');
    }

    getJobFailedRecordResults() {
        this.getJobRecordResults('failedResults');
    }

    getJobUnprocessedRecordResults() {
        this.getJobRecordResults('unprocessedrecords');
    }

    getJobRecordResults(resultType) {
        this.isLoading = true;

        fetch(this.bulkApiV2EndpointUrl + '/' + this.bulkJob.id + '/' + resultType, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.sessionId 
            }

        }).then(response => {
            console.log('response -> ', response);

            if (response.status < 300) {
                return response.text();

            } else {
                throw response.status + ': ' + response.statusText;
            }

        }).then(csvResult => {
            if (csvResult) {
                var hiddenElement = document.createElement('a');

                hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvResult);
                hiddenElement.target = '_blank';
                hiddenElement.download = this.bulkJob.object + '_' + resultType + '_' + this.bulkJob.id + '.csv';

                hiddenElement.click();

            } else {
                throw 'Failed on fetching CSV Result!';
            }

        }).catch(error => {
            console.log('callout error -> ', error);

            this.toast(error, 'error');

        }).finally(() => {
            this.isLoading = false;
        })
    }

    generateCsvTemplate() {
        const csvTemplateFields = JSON.parse(JSON.stringify(this.csvTemplateFields)).slice();
        const csvTemplateFieldsSplitted = JSON.parse(JSON.stringify(csvTemplateFields.split(',')));
        const headers = JSON.parse(JSON.stringify(headerArrayToJSON(csvTemplateFieldsSplitted)));

        console.log('~ generateCsvTemplate -> csvTemplateFields', csvTemplateFields);
        console.log('~ generateCsvTemplate -> csvTemplateFieldsSplitted', csvTemplateFieldsSplitted);
        console.log('~ generateCsvTemplate -> headers', headers);

        exportCSVFile(headers, null, 'Template_' + this.objectApiName);
    }

    toast(title, variant) {
        const toastEvent = new ShowToastEvent({
            title: title, 
            variant: variant
        });

        this.dispatchEvent(toastEvent);
    }

    get disabledProcessBulkUploadButton() {
        return !(this.uploadedFiles && this.uploadedFiles.length > 0);
    }

    get bulkJobState() {
        return (this.bulkJob && this.bulkJob.state ? this.bulkJob.state : null);
    }

    get isBulkJobStateJobCompleted() {
        return (this.bulkJob && this.bulkJob.state == 'JobComplete');
    }

    get isObjectApiNameReadOnly() {
        return (this.objectApiNameRef != null && this.objectApiNameRef != '');
    }

    get isExternalIdFieldNameReadOnly() {
        return (this.externalIdFieldName != null && this.externalIdFieldName != '');
    }

    get isOperationReadOnly() {
        return (this.operationRef != null && this.operationRef != '');
    }

    get isCsvTemplateFieldsReadOnly() {
        return (this.csvTemplateFieldsRef != null && this.csvTemplateFieldsRef != '');
    }
}