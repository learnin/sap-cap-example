package com.example.sap_cap_example.handlers;

import cds.gen.my.bookshop.Books;
import cds.gen.northwind.Products;
import com.sap.cds.Result;
import com.sap.cds.Struct;
import com.sap.cds.ql.CQL;
import com.sap.cds.ql.Select;
import com.sap.cds.ql.cqn.CqnSelect;
import com.sap.cds.services.cds.CdsReadEventContext;
import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import com.sap.cds.services.persistence.PersistenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/***
 * S/4HANA Side-by-Side 拡張のサンプル
 * S/4HANA のデータとHANA Cloudのデータを取得し、マージして返す
 * ただし、S/4HANAのODataサービス呼び出しは実際には行わずダミーで固定値をセットしている
 */
@Component
@ServiceName(cds.gen.northwindservice.NorthWindService_.CDS_NAME)
public class NorthWindServiceHandler implements EventHandler {

    private final static Logger logger = LoggerFactory.getLogger(NorthWindServiceHandler.class);

    @Resource
    private PersistenceService persistenceService;

    @On(entity = cds.gen.northwindservice.Products_.CDS_NAME)
    public List<cds.gen.northwindservice.Products> readProducts(CdsReadEventContext context) {
        // 実際には SAP Cloud SDK を使用して Cloud Connector 経由でオンプレの S/4HANA の OData サービスから取得する
        Products products = Struct.create(Products.class);
        products.setId(1);
        products.setName("name1");
        products.setDescription("description1");

        // 取得したデータをレスポンスのエンティティに詰め直す
        cds.gen.northwindservice.Products serviceProducts = Struct.create(cds.gen.northwindservice.Products.class);
        serviceProducts.setId(products.getId());
        serviceProducts.setName(products.getName());
        serviceProducts.setDescription(products.getDescription());

        return Arrays.asList(serviceProducts);
    }

    @On(entity = cds.gen.northwindservice.MixinProducts_.CDS_NAME)
    public List<cds.gen.northwindservice.MixinProducts> readMixinProducts(CdsReadEventContext context) {
        // 実際には SAP Cloud SDK を使用して Cloud Connector 経由でオンプレの S/4HANA の OData サービスから取得する
        Products products = Struct.create(Products.class);
        products.setId(1);
        products.setName("name1");
        products.setDescription("description1");

        // DBから取得する
        CqnSelect query = Select.from(cds.gen.my.bookshop.Books_.class)
                .columns(b -> b.title())
                .where(b -> b.ID().eq(CQL.param(Books.ID)))
                .orderBy(Books.ID);
        Map<String, Object> paramValues = new HashMap<>();
        paramValues.put(Books.ID, products.getId());
        String hoge = persistenceService.run(query, paramValues).single(Books.class).getTitle();

        // それぞれから取得したデータをレスポンスのエンティティに詰め直す
        cds.gen.northwindservice.MixinProducts mixinProducts = Struct.create(cds.gen.northwindservice.MixinProducts.class);
        mixinProducts.setId(products.getId());
        mixinProducts.setName(products.getName());
        mixinProducts.setDescription(products.getDescription());
        mixinProducts.setHoge(hoge);

        return Arrays.asList(mixinProducts);
    }

    @On(entity = cds.gen.northwindservice.CustomProducts_.CDS_NAME)
    public List<cds.gen.northwindservice.CustomProducts> readCustomProducts(CdsReadEventContext context) {
        // 実際には SAP Cloud SDK を使用して Cloud Connector 経由でオンプレの S/4HANA の OData サービスから取得する
        List<Products> productsList = new ArrayList<>();
        Products products1 = Struct.create(Products.class);
        products1.setId(1);
        products1.setName("name1");
        productsList.add(products1);
        Products products2 = Struct.create(Products.class);
        products2.setId(2);
        products2.setName("name2");
        productsList.add(products2);

        // DBから取得する
        CqnSelect query = Select.from(cds.gen.my.bookshop.Books_.class)
                .columns(b -> b.ID(),
                        b -> b.title())
                .where(b -> b.ID().in(productsList.stream().map(Products::getId).collect(Collectors.toList())))
                .orderBy(Books.ID);
        Result booksResult = persistenceService.run(query);

        // 突き合わせのための検索時のパフォーマンスを考慮し、一旦HashMapに格納する
        Map<Integer, Books> booksMap = booksResult.streamOf(Books.class)
                .collect(Collectors.toMap(Books::getId, Function.identity()));

        // それぞれから取得したデータをレスポンスのエンティティに詰め直す
        List<cds.gen.northwindservice.CustomProducts> customProductsList = productsList.stream().map(products -> {
            cds.gen.northwindservice.CustomProducts customProducts = Struct.create(cds.gen.northwindservice.CustomProducts.class);
            customProducts.setId(products.getId());
            customProducts.setName(products.getName());

            Books books = booksMap.get(products.getId());
            if (books != null) {
                customProducts.setTitle(books.getTitle());
            }
            return customProducts;
        }).collect(Collectors.toList());

        return customProductsList;
    }
}
