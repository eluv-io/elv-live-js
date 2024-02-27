
# MEDIA WALLET - PROPERTY SITES

## PROBLEMS TO SOLVE

Our tenant (customer) requires a site matching their branding and specific situation.

Some common requirements:

- custom login dialogs (including ability to log in with Google, etc)
- require list of users that log on to the site
- custom oauth provider (using their own login)
- custom landing page - including how the SIGN ON button appears, and its text
- some custom CTA - "BUY NOW", "JOIN ..."
- custom navigation:
  - "My Movies" (instead of "My Media")
- special footer (terms, faq, support, etc)

## PROPOSED SOLUTION

For web, have two separate instances of the app:

### 1. The Eluvio Media Wallet

  This site is built for the consumer. No customizations for the property owner other than the
  layouts of the property, sections and media.

  - our login (no custom login)
    - no logins are reported to tenants
  - 'My Media', 'My Items'
    - show all items across all properties
  - 'Discover' section across all properties, search across all properties
    - shows properties to the extent they can be customized in our system and authoring tool

  The footer and special links are exclusively Eluvio (terms, FAQ, support)


### 2. The tenant site - uefa.tv  web3.wb.com  dollyverse.com

  This site uses the same property definition and renders the property the same way
  as the media wallet, but the header/footer and front page can be customized

  - customizable login
    - including style, workflow, text, consent
  - all logins are reported to the tenant
  - customizable My Media and My Items links 
  - customizable header (home button, maybe other things)
  - customizable footer (terms, faq, support links)

 
