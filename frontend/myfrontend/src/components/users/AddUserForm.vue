<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'
import { formatPhoneNumber } from '@/utils/helpers'

export default {
  data() {
    return {
      formData: {
        name: '',
        phone: '',
        email: '',
        password: '',
        roleID: '',
        team: 'JSC',
      },
      teams: [
        { value: 'JSC', label: 'JSC' },
        { value: 'eboard', label: 'E-Board' },
        { value: 'tonerSupport', label: 'Toner Support' },
        { value: 'networkSupport', label: 'Network Support' },
        { value: 'softwareSupport', label: 'Software Support' }
      ],
      roles: [],
      loadingRoles: false,
      loading: false,
      formSubmitted: false,
      toastElement: null
    }
  },

  computed: {
    formattedPhoneNumber: {
      get() {
        return formatPhoneNumber(this.formData.phone)
      },
      set(value) {
        this.formData.phone = value
      }
    }
  },

  mounted() {
    this.fetchRoles()
  },

  watch: {
    'formData.phone': function (newVal) {
      if (newVal) {
        this.formData.phone = formatPhoneNumber(newVal)
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

    async fetchRoles() {
      try {
        this.loadingRoles = true

        const res = await axios.get(`${Const.BASE_URL}/roles/list`, {
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        if (res.data?.status === 200) {
          this.roles = res.data?.data?.roles || []
        } else {
          this.roles = []
          this.showToast(res.data?.message || 'Failed to load roles', true)
        }

      } catch (err) {
        console.error('Fetch roles error:', err)
        this.roles = []
        this.showToast(
          err?.response?.data?.message || 'Failed to fetch roles',
          true
        )
      } finally {
        this.loadingRoles = false
      }
    },

    async handleSubmit() {
      try {
        if (
          !this.formData.name ||
          !this.formData.phone ||
          !this.formData.email ||
          !this.formData.password ||
          !this.formData.roleID
        ) {
          this.showToast('Please fill all required fields.', true)
          return
        }

        this.loading = true

        const submitData = {
          name: this.formData.name,
          phone: this.formData.phone,
          email: this.formData.email,
          password: this.formData.password,
          roleID: this.formData.roleID,
          team: this.formData.team || 'JSC'
        }

        const res = await axios.post(`${Const.BASE_URL}/users/create`, submitData, {
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        if (res.data?.status === 200) {
          this.showToast('User successfully created', false)
          this.resetForm()
          this.$emit('user-Added')
        } else {
          const message = res.data.message || 'Failed to create user'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error:', error.response?.data || error.message)
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Failed to create user, please try again'

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
        roleID: '',
        team: 'JSC'
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

              <select
                v-model="formData.roleID"
                class="form-control"
                :disabled="loadingRoles"
              >
                <option value="">
                  {{ loadingRoles ? 'Loading roles...' : 'Select Role' }}
                </option>

                <option
                  v-for="role in roles"
                  :key="role.roleID"
                  :value="role.roleID"
                >
                  {{ role.roleName }}
                </option>
              </select>
            </div>

            <div class="col-md-6 mb-3">
              <label for="team" class="form-label">Team</label>

              <select
                id="team"
                class="form-control"
                v-model="formData.team"
              >
                <option
                  v-for="team in teams"
                  :key="team.value"
                  :value="team.value"
                >
                  {{ team.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-if="!loading">Add User</span>
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