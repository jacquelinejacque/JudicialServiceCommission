
<script>
import { Const } from '@/utils/constants';
import axios from 'axios';
import Toastify from 'toastify-js'
import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'

export default {
    props: {
        userId: {
            type: String,
            required: true
        }
    },


    data() {
        return {
            formData: {
                password: '',
            },

            loading: false,
            formSubmitted: false,
            toastElement: null
        };
    },

    watch: {
        userId: {
            immediate: true,
            handler: 'fetchUser'
        }
    },

    mounted() {
        this.toastElement = new Toast(document.getElementById('password-toast'));
    },

    methods: {
        showToast(message, isDanger) {
            Toastify({
                text: message,
                // className: className,
                style: {
                background: isDanger ? '#d63939' : '#2fb344'
                }
            }).showToast()
        },


        async handleSubmit() {
            try {
                this.loading = true
                const payload = {
                    userId: this.userId,
                    password: this.formData.password,
                }
                console.log("Payload UserID:", payload.userId);
                var config = {
                    method: 'post',
                    url: `${Const.BASE_URL}/users/passwordReset`,
                    data: payload,
                    headers: {
                        'access-token': localStorage.getItem('accessToken')
                    },
                }

                const res = await axios.request(config)
                console.log(res.data)
                if (res.data.status !== 200) throw new Error
                this.showToast('Password Updated Succesfully')
                setTimeout(() => {
                    window.location.reload()
                }, 1000);
            } catch (error) {
                console.error(error)
                this.showToast('Failed to update password. Please try again')
            } finally {
                this.loading = false

            }
        },
    },


};
</script>



<template>
    <div>
        <form @submit.prevent="handleSubmit">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">New User</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="mb-3 col-md-6">
                            <label for="passsword" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" v-model="formData.password">
                        </div>

                      

                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn btn-primary" :disabled="loading"><span
                            v-if="loading">Submitting...</span>
                        <span v-if="!loading">Submit</span>
                    </button>
                </div>

            </div>
        </form>

        <div class="position-absolute top-0 start-50 translate-middle-x p-3" style="z-index: 11">
            <div id="password-toast" class="toast align-items-center" role="alert" aria-live="assertive"
                aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body password-toast-body"></div>
                    <button type="button" class="btn-close ms-auto me-2" aria-label="Close" @click="hideToast"></button>
                </div>
            </div>
        </div>

    </div>
</template>



<style>
.form {
    display: flex;
    flex-direction: column;

}
</style>