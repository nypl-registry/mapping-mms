# mapping-mms
Map resources from MMS to Archives/TMS/Catalog


###mmsCollectionsToArchivesCollections
Maps MMS collections to Archive collections based on MSS and bNumber
Updates mmsCollections and archivesCollections collections.
MMS Collections will have these properties if matched

```
matchedArchives: true,
matchedArchivesType: 'identifier',
archivesCollectionDb: [ 6496 ]
```

Archives will have these values

```
matchedMms: true,
matchedMmsType: 'identifier',
mmsUuid: 'ea489f60-c602-012f-a845-58d385a7bc34'
```

---
###mmsCollectionsToArchivesCollectionsByTitle
Finds mms collections that have no identfiers that can be used and does a very hight threshold title match agains archives collections. Sets the same data as above except

```
matchedArchivesType: 'title',
```
---
###mmsItemCollectionsToArchivesCollections
Maps MMS items, that are collections (top level items) to Archive collections based on MSS and bNumber. Sets the same data as above.


