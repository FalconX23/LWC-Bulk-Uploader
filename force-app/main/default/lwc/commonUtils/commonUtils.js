export function exportCSVFile(headers, totalData, fileTitle) {
    const jsonObject = JSON.stringify(totalData);
    const result = convertToCSV(jsonObject, headers);

    if (result === null) {
        return;
    }

    const blob = new Blob([result]);
    const exportedFilename = fileTitle ? fileTitle + '.csv' : 'export.csv';

    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, exportedFilename);

    } else if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        const hiddenElement = window.document.createElement('a');

        hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(result);
        hiddenElement.target = '_blank';
        hiddenElement.download = exportedFilename;
        hiddenElement.click();

    } else {
        const hiddenElement = document.createElement('a');
        const url = URL.createObjectURL(blob);

        hiddenElement.setAttribute('href', url);
        hiddenElement.setAttribute('download', exportedFilename);
        hiddenElement.style.visibility = 'hidden';
        document.body.appendChild(hiddenElement);
        hiddenElement.click();
        document.body.removeChild(hiddenElement);
    }
}

export function headerArrayToJSON(headers) {
    const headersJSON = {};

    if (headers && headers.length > 0) {
        headers.forEach(header => {
            headersJSON[header] = header;
        });

        return headersJSON;
    }

    return null;
}

function convertToCSV(objArray, headers) {
    const columnDelimiter = ',';
    const lineDelimiter = '\r\n';
    const actualHeaderKey = Object.keys(headers);
    const headerToShow = Object.values(headers);

    let str = '';
    str += headerToShow.join(columnDelimiter);
    str += lineDelimiter;

    const data = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray

    if (data && data.length > 0) {
        data.forEach(obj => {
            let line = '';

            actualHeaderKey.forEach(key => {
                if (line != '') {
                    line += columnDelimiter
                }

                let strItem = obj[key] + '';

                line += strItem ? strItem.replace(/,/g, '') : strItem;
            });

            str += line + lineDelimiter;
        });
    }

    return str;
}