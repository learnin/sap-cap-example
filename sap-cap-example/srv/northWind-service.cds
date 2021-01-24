using { NorthWind as external } from './external/NorthWind.csn';

service NorthWindService {

    @readonly
    entity Products as projection on external.Products {
        key ID,
        Name,
        Description
    };

    @readonly
    entity MixinProducts : external.Products {
        Hoge : String;
    };

    @readonly
    entity CustomProducts {
        key ID : Integer;
        Name : String;
        Title : String;
    };

}
