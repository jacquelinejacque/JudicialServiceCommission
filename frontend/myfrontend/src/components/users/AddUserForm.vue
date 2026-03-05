<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'
//import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'
import { formatPhoneNumber } from '@/utils/helpers'

export default {
  data() {
    return {
      formData: {
        name: '',
        phone: '',
        email: '',
        password: '',
        role: '',
      },
      loading: false,
      formSubmitted: false,
      toastElement: null
    }
  },
  computed: {
  formattedPhoneNumber: {
    get() {
      return formatPhoneNumber(this.formData.phone);
    },
    set(value) {
      this.formData.phone = value;
    }
  }
},

  watch: {
  'formData.phone': function (newVal) {
    if (newVal) {
      this.formData.phone = formatPhoneNumber(newVal);
    }
  }
},


  methods: {
    showToast(message, isDanger) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },
    async handleSubmit() {
      try {
        if (!this.formData.name || !this.formData.phone || !this.formData.email || !this.formData.password || !this.formData.role) {
        this.showToast('Please fill all required fields.', true)
        return
        }

        this.loading = true
        const submitData = {
            name: this.formData.name,
            phone: this.formData.phone,
            email: this.formData.email,
            password: this.formData.password,
            role: this.formData.role
        }

        console.log('Submitting data:', submitData)

        const res = await axios.post(`${Const.BASE_URL}/users/create`, submitData, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })
        console.log(res.data)
        if (res.data?.status === 200) {
          this.showToast('User successfully created', false)
          this.$emit('user-Added');
        } else {
          const message = res.data.message || 'Failed to create user'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error:', error.response?.data || error.message)
        const message = error.response?.data?.message || 'Failed to create user, please try again'
        this.showToast(message, true)
      } finally {
        this.loading = false
      }
    },


    resetForm() {
      this.formData = {
        name: '',
        phone: '',
        email: '',
        password: '',
        role: '',
      }

      this.formSubmitted = true
    }
  }
}
</script>

<template>
  <div>
  
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">New User</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="name" class="form-label">Name</label>
              <input type="text" class="form-control" id="name" v-model="formData.name"  />
            </div>
            <div class="col-md-6 mb-3">
              <label for="phone" class="form-label">phone</label>
              <input
                type="tel"
                class="form-control"
                id="phone"
                v-model="formData.phone"                
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="email" class="form-label">email</label>
              <input
                type="email"
                class="form-control"
                id="email"
                v-model="formData.email"                
              />
            </div>
            <div class="col-md-6 mb-3">
            <label for="password" class="form-label">Password</label>
            <input type="password" class="form-control" id="password" v-model="formData.password"  />
            </div>

            <div class="col-md-6 mb-3">
            <label class="form-label text-weight-1000">Select Role</label>
                <select v-model="formData.role" class="form-control">
                <option value="">Select Role</option>
                <option value="admin">Admin</option>
                <option value="client">Client</option>
                </select>
           
            </div>

          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-if="!loading">Submit</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style>
.form {
  display: flex;
  flex-direction: column;
}
</style>