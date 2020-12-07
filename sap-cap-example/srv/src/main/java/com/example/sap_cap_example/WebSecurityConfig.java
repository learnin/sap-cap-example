package com.example.sap_cap_example;

import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@EnableWebSecurity
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        // Spring SecurityのBASIC認証を無効化する
        http.authorizeRequests().anyRequest().permitAll();

        // FIXME: CSRFトークンチェックを仮で無効化。後で有効化必要
        http.csrf().disable();
    }

}
