<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'
import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'

export default {
  props: {
    user: { type: Object, required: true }
  },
  data() {
    return {
      routes: null,
      userType: null,
      formData: {
        name: '',
        phone: '',
        role: '',
        email: '',
      },
      loading: false,
      formSubmitted: false,
      toastElement: null
    }
  },

  watch: {
    user: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.formData = {
            ...newVal,
          }
        }
      }
    },
    
  },

  mounted() {
    (this.toastElement = new Toast(document.getElementById('newUser-toast')))
   
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
        const updateData = {
          userId: this.user.userID,
          name: this.formData.name,
          email: this.formData.email,
          phone: this.formData.phone,
          role: this.formData.role,
        }
        const res = await axios.post(`${Const.BASE_URL}/users/update`, updateData, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })
        console.log(res.data)
        if (res.data?.status === 200) {
          this.showToast('User details successfully updated', false)
          this.$emit('user-Edited');
        } else {
          const message = res.data.message || 'Failed to update user'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error(error)
        this.showToast('Failed to update user')
      } finally {
        this.loading = false
      }
    },
   
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Edit User Details</h5>
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
              <input type="text" class="form-control" id="name" v-model="formData.name" required />
            </div>
           
            <div class="col-md-6 mb-3">
              <label for="phone" class="form-label">phone</label>
              <input
                type="tel"
                class="form-control"
                id="phone"
                v-model="formData.phone"
                required
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="email" class="form-label">email</label>
              <input
                type="email"
                class="form-control"
                id="email"
                v-model="formData.email"
                required
              />
            </div>
                        <div class="col-md-6 mb-3">
                            <label for="role" class="form-label">Role</label>
                            <select
                                class="form-control"
                                id="role"
                                v-model="formData.role"
                                required
                            >
                                <option disabled value="">Select Role</option>
                                <option value="client">Client</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>            
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Updating...</span>
            <span v-if="!loading">Update</span>
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

.list-group-item-primary {
  background-color: #d1ecf1;
  color: #0c5460;
  font-weight: bold;
}
</style>