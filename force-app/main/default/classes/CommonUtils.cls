/**
    @author:            Stephen Laylo
    @company:           J4RVIS
    @description:       Utility class that should hold all methods that are reused across the application
*/
public without sharing class CommonUtils {

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to retrieve the Base URL in External Form
    */
    @AuraEnabled
    public static String getSalesforceBaseUrlExternalForm() {
        return URL.getSalesforceBaseUrl().toExternalForm();
    }

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to retrieve the Org Domain URL in External Form
    */
    @AuraEnabled
    public static String getOrgDomainUrlExternalForm() {
        return URL.getOrgDomainUrl().toExternalForm();
    }

    @AuraEnabled
    public static String getSessionId() {        
        return UserInfo.getSessionId();
    }

    @AuraEnabled
    public static String getSessionIdFromInternal() {
        String sessionId = '';
        String substring = '';

        try {
            sessionId = Page.GenerateSessionIdForLWC.getContent().toString();
            substring = sessionId.substring(0, sessionId.indexof(' '));

        } catch (Exception ex) {
            System.debug('~~ CommunitiesAppLauncherController -> getSessionIdFromInternal() -> ex: ' + ex);
        }
  
        return substring;
    }

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to convert bytes to kilobytes, megabytes or gigabytes

        @params:            value         -    value of bytes
    */
    public static String getFileSizeToString(Long value) {
        /* string representation if a file's size, such as 2 KB, 4.1 MB, etc */
        if (value < 1024) {
            return String.valueOf(value) + ' Bytes';

        } else if (value >= 1024 && value < (1024 * 1024)) {
            //KB
            Decimal kb = Decimal.valueOf(value);
            kb = kb.divide(1024, 2);

            return String.valueOf(kb) + ' KB';

        } else if (value >= (1024 * 1024) && value < (1024 * 1024 * 1024)) {
            //MB
            Decimal mb = Decimal.valueOf(value);
            mb = mb.divide((1024 * 1024), 2);

            return String.valueOf(mb) + ' MB';

        } else {
            //GB
            Decimal gb = Decimal.valueOf(value);
            gb = gb.divide((1024 * 1024 * 1024), 2);

            return String.valueOf(gb) + ' GB';
        }
    }

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to retrieve fieldsets from specified object

        @params:            fieldSetName         -    fieldset name
        @params:            objectName           -    object name
    */
    public static List<Schema.FieldSetMember> readFieldSet(String fieldSetName, String objectName) {
        Map<String, Schema.SObjectType> globalDescribeMap = Schema.getGlobalDescribe(); 
        Schema.SObjectType sObjectTypeObj = globalDescribeMap.get(objectName);
        Schema.DescribeSObjectResult describeSObjectResultObj = sObjectTypeObj.getDescribe();
        Schema.FieldSet fieldSetObj = describeSObjectResultObj.FieldSets.getMap().get(fieldSetName);
 
        return fieldSetObj.getFields(); 
    }

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to retrieve Object type from record ID

        @params:            recordIdOrPrefix         -    Record ID or ID Prefix
    */
    public static String findObjectNameFromRecordIdPrefix(String recordIdOrPrefix) {
        String objectName = '';

        try {
            //Get prefix from record ID
            //This assumes that you have passed at least 3 characters
            String myIdPrefix = String.valueOf(recordIdOrPrefix).substring(0,3);

            //Get schema information
            Map<String, Schema.SObjectType> gd =  Schema.getGlobalDescribe(); 

            //Loop through all the sObject types returned by Schema
            for (Schema.SObjectType stype : gd.values()) {

                //if (!sObj.contains('__')) to exclude managed package objects

                Schema.DescribeSObjectResult r = stype.getDescribe();
                String prefix = r.getKeyPrefix();

                //Check if the prefix matches with requested prefix
                if (prefix != null && prefix.equals(myIdPrefix)) {
                    objectName = r.getName();

                    break;
                }
            }
        } catch (Exception e) {
            System.debug(e);
        }

        return objectName;
    }

    /**
        @author:            Stephen Laylo
        @company:           J4RVIS
        @description:       Method to parse CSV content

        @params:            contents            -    CSV contents
        @params:            skipHeaders         -    flag to include/exclude headers
    */
    public static List<List<String>> parseCSV(String contents, Boolean skipHeaders) {
        List<List<String>> allFields = new List<List<String>>();
        contents = contents.replaceAll('ï»¿', '');

        // replace instances where a double quote begins a field containing a comma 
        // in this case you get a double quote followed by a doubled double quote 
        // do this for beginning and end of a field

        contents = contents.replaceAll(',"""', ',"DBLQT').replaceall('""",', 'DBLQT",');

        // now replace all remaining double quotes - we do this so that we can reconstruct
        // fields with commas inside assuming they begin and end with a double quote

        contents = contents.replaceAll('""', 'DBLQT');

        // we are not attempting to handle fields with a newline inside of them 
        // so, split on newline to get the spreadsheet rows 

        List<String> lines = new List<String>();

        try {
            lines = contents.split('\r\n');

        }  catch (System.ListException e) {
            System.debug('Limits exceeded?' + e.getMessage());
        }

        Integer num = 0;

        for (String line : lines) {
            // check for blank CSV lines (only commas)
            if (line.replaceAll(',', '').trim().length() == 0) {
                break;
            }
 
            List<String> fields = line.split(',');
            List<String> cleanFields = new List<String>();
            String compositeField;  
            Boolean makeCompositeField = false;

            for (String field : fields ) {
                if (field.startsWith('"') && field.endsWith('"')) {
                    cleanFields.add(field.replaceAll('DBLQT', '"'));

                } else if (field.startsWith('"')) {
                    makeCompositeField = true;
                    compositeField = field;

                } else if (field.endsWith('"')) {
                    compositeField += ',' + field;
                    cleanFields.add(compositeField.replaceAll('DBLQT', '"'));
                    makeCompositeField = false;

                } else if (makeCompositeField) {
                    compositeField +=  ',' + field;

                } else {
                    cleanFields.add(field.replaceAll('DBLQT', '"'));
                }
            }

            allFields.add(cleanFields);
        }

        if (skipHeaders) {
            allFields.remove(0);
        }

        return allFields;
    }

}