## ForAllBackpacks - Issuer API
### Installation:

To access the ForAllBackpacks Issuer API, include a link to the script in your site as follows:
```
<script src="https://www.forallbackpacks.com/js/issuer.js"></script>
```
You can then access the API methods using the ForAllBackpacks object.

### Methods:
The ForAllBackpacks Issuer API provides the following methods: issue and issue_no_modal.

#### issue(assertions, callback)
Presents the user with a modal dialog that requests their consent to add the issuer's badge(s) to their ForAllBackpack. If the user is not currently logged into ForAllBackpacks, they will first be asked to log in or create an account if necessary.

##### Parameters
| Parameter   |  |
|---|---|
| assertions | Array of URLs to push to the ForAllBackpack. |
| callback | Function that may execute when returning from the ForAllBackpack interaction. |

##### Callback

If called, the callback function receives the following parameters:

| Parameter   |  |
|---|---|
| errors | Array of assertions not added to the ForAllBackpack (each represented by URL). |
| successes | Array of assertions successfully added to the ForAllBackpack (each represented by URL). |

##### Example method call

```
var assertions = ['http://yoursite.com/badge-assertion.json', 
  'http://yoursite.com/other-badge-assertion.json',
  ...
  ];
ForAllBackpacks.issue(assertions, function(errors, successes) {
 //...
});
```

#### issue_no_modal(assertions)
Redirects the page to a full-window version of the modal dialog described for issue. While this does not allow the invocation of a callback with the results of the interaction, it is generally more compatible with older browsers.
##### Parameters

| Parameter   |  |
|---|---|
| assertions | Array of URLs to push to the ForAllBackpack. |

##### Example method call
```
var assertions = ['http://yoursite.com/badge-assertion.json', 
  'http://yoursite.com/other-badge-assertion.json',
  ...
  ];
ForAllBackpacks.issue_no_modal(assertions);
```
