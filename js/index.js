document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
    
    const menuExpander = document.getElementById("menu-expander");
    const expandedMenu = document.getElementById("expanded-menu");

    menuExpander.addEventListener('click', () => {
        expandedMenu.classList.toggle('menu-visible')
        if (expandedMenu.classList.contains('menu-visible')) {
          menuExpander.textContent = "✕";
        } else {
          menuExpander.textContent = "≡"
        }
      }
    )

});
