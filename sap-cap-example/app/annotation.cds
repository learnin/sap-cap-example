using CatalogService from '../srv/cat-service';

annotate CatalogService.Books with @(UI : {
    SelectionFields : [
    ID,
    title,
    stock
    ],
    LineItem        : [
    {Value : ID},
    {Value : title},
    {Value : stock}
    ]
});
