using CatalogService from './cat-service';

annotate CatalogService.Books with @(UI: {
    HeaderInfo: {
        TypeName: 'Book',
        TypeNamePlural: 'Books',
        Title: {Value: ID},
        Description: {Value: title}
    },
    SelectionFields: [
        ID,
        title,
        stock
    ],
    LineItem: [
        {Value : ID},
        {Value : title},
        {Value : stock}
    ],
    Facets: [
        {
            $Type: 'UI.CollectionFacet',
            Label: 'Book Info',
            Facets: [
                {$Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Main', Label: 'Main Facet'}
            ]
        }
    ],        
    FieldGroup#Main: {
        Data: [
            {Value: ID},
            {Value: title},
            {Value: stock}           
        ]
    }
});
annotate CatalogService.Books with {modifiedAt @odata.etag};
