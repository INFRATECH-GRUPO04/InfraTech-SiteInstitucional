const openModalButtons = document.querySelectorAll('.open-modal');


openModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modalId = button.getAttribute('data-modal');
        const modal = document.getElementById(modalId);

        modal.showModal();
    });
});

const switchModalButtons = document.querySelectorAll('.switch-modal');
switchModalButtons.forEach(button => {
    button.addEventListener('click', event => {
        event.preventDefault();

        const currentModal = button.closest('dialog');
        const modalId = button.getAttribute('data-modal');
        const targetModal = document.getElementById(modalId);

        currentModal.close();
        targetModal.showModal();
    });
});

const closeModalButtons = document.querySelectorAll('.close-modal');
closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('dialog');

        modal.close();
    });
});

